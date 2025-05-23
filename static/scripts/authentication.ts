import { createClient, SupabaseClient, Session } from "@supabase/supabase-js";
import { Octokit } from "@octokit/rest";
import { GitHubUser } from "../types/github";
import { CONFIG_ORG_REPO } from "@ubiquity-os/plugin-sdk/constants";

declare const SUPABASE_URL: string;
declare const SUPABASE_ANON_KEY: string;
declare const SUPABASE_STORAGE_KEY: string;
declare const NODE_ENV: string;

export class AuthService {
  supabase: SupabaseClient;
  octokit: Octokit | null = null;

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  isActiveSession(): boolean {
    const token = localStorage.getItem(`sb-${SUPABASE_STORAGE_KEY}-auth-token`);
    return !!token;
  }

  async getSessionToken(): Promise<string | null> {
    const localToken = localStorage.getItem(`sb-${SUPABASE_STORAGE_KEY}-auth-token`);
    if (localToken) {
      return JSON.parse(localToken).provider_token;
    }
    return this.getNewSessionToken();
  }

  async getNewSessionToken(): Promise<string | null> {
    const hash = window.location.hash;
    if (!hash) return null;

    const params = new URLSearchParams(hash.substring(1));
    const providerToken = params.get("provider_token");
    if (!providerToken) {
      console.error(`GitHub login provider: ${params.get("error_description")}`);
    }
    return providerToken;
  }

  async getSupabaseSession(): Promise<Session | null> {
    if (NODE_ENV === "development") {
      const token = localStorage.getItem(`sb-${SUPABASE_STORAGE_KEY}-auth-token`);
      if (token) {
        return JSON.parse(token);
      }
    }
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    return session;
  }

  public async getGitHubAccessToken(): Promise<string | null> {
    const session = await this.getSupabaseSession();
    if (session?.expires_at && session.expires_at < Date.now() / 1000) {
      localStorage.removeItem(`sb-${SUPABASE_STORAGE_KEY}-auth-token`);
      return null;
    }
    return session?.provider_token || null;
  }

  public async signInWithGithub(): Promise<void> {
    const search = window.location.search;
    localStorage.setItem("manifest", search);
    const { data } = await this.supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "read:org read:user user:email repo",
        redirectTo: `${window.location.href}`,
      },
    });
    if (!data) throw new Error("Failed to sign in with GitHub");
  }

  public async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    localStorage.removeItem(`sb-${SUPABASE_STORAGE_KEY}-auth-token`);
    window.location.reload();
  }

  public async renderGithubLoginButton(user?: GitHubUser | null): Promise<void> {
    const button = document.getElementById("github-sign-in");
    if (!button) throw new Error("Missing sign in button");

    const session = await this.getSupabaseSession();
    user = user || (await this.getNewGitHubUser(session?.provider_token || null));

    const preAuthManifest = localStorage.getItem("manifest");
    const isUrlEmpty = !window.location.search || !window.location.hash;
    if (preAuthManifest && isUrlEmpty && user) {
      const search = localStorage.getItem("manifest");
      localStorage.removeItem("manifest");
      window.location.search = `${search}`;
    }

    if (user) {
      button.textContent = `Sign out ${user.login}`;
      button.addEventListener("click", async () => {
        await this.signOut();
        await this.renderGithubLoginButton(null);
      });
    } else {
      button.textContent = "Sign in with GitHub";
      button.addEventListener("click", async () => {
        await this.signInWithGithub();
      });
    }
  }

  public async getGitHubUser(): Promise<GitHubUser | null> {
    const token = await this.getSessionToken();
    return this.getNewGitHubUser(token);
  }

  async getNewGitHubUser(token: string | null): Promise<GitHubUser | null> {
    if (!token) return null;
    const octokit = new Octokit({ auth: token });
    try {
      const response = await octokit.request("GET /user");
      this.octokit = octokit;
      return response.data as GitHubUser;
    } catch (error) {
      console.error("Failed to get user", error);
      await this.signOut();
      await this.renderGithubLoginButton(null);
      return null;
    }
  }

  public async getGitHubUserOrgs(): Promise<string[]> {
    const user = await this.octokit?.rest.users.getAuthenticated();
    const listForAuthUser = await this.octokit?.rest.orgs.listForAuthenticatedUser();
    if (!user || !listForAuthUser) return [];
    const listForUserPublic = await this.octokit?.rest.orgs.listForUser({ username: user?.data.login });
    const allOrgs = [...(listForAuthUser?.data || []), ...(listForUserPublic?.data || [])].map((org) => org.login);

    const orgConfigPermissions: Record<string, string> = {};

    const getOrgConfigRepoUserPermissions = async (org: string) => {
      try {
        const p = await this.octokit?.rest.repos.getCollaboratorPermissionLevel({ owner: org, repo: CONFIG_ORG_REPO, username: user?.data.login });
        orgConfigPermissions[org] = p?.data.permission || "none";
      } catch (er) {
        console.error(`[getOrgConfigPermissions] - ${org}::`, er);
      }
    };

    for (const org of allOrgs) {
      await getOrgConfigRepoUserPermissions(org);
    }

    return Array.from(
      new Set([
        ...(listForAuthUser?.data.map((org) => org.login) || []),
        ...Object.keys(orgConfigPermissions).filter((org) => orgConfigPermissions[org] !== "none"),
      ])
    );
  }

  public async getGitHubUserOrgRepos(orgs: string[]): Promise<Record<string, string[]>> {
    const octokit = await this.getOctokit();
    const orgRepos: Record<string, string[]> = {};
    for (const org of orgs) {
      const response = await octokit.rest.repos.listForOrg({ org });
      orgRepos[org] = response.data.map((repo: { name: string }) => repo.name);
    }
    return orgRepos;
  }

  public async getOctokit(): Promise<Octokit> {
    if (this.octokit) return this.octokit;
    const token = await this.getSessionToken();
    return new Octokit({ auth: token });
  }
}
