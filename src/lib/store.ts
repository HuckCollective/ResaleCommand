import { map } from 'nanostores';
import type { Models } from 'appwrite';
import { auth } from './auth';
import { isAlphaMode } from '../stores/env';
import { isPublicPagePath, buildLoginRedirect } from './publicRoutes';

export interface AuthStoreState {
  user: Models.User<Models.Preferences> | null;
  isAuthenticated: boolean;
  isPartner: boolean;
  teams: Models.Team[];
  currentTeam: Models.Team | null;
  ownedTeam: Models.Team | null;
  loading: boolean;
}

export const authStore = map<AuthStoreState>({
  user: null,
  isAuthenticated: false,
  isPartner: false,
  teams: [],
  currentTeam: null,
  ownedTeam: null,
  loading: true,
});


export const SESSION_HINT_KEY = 'rc_has_session';

function setAuthCookie() {
    if (typeof document !== 'undefined') {
        document.cookie = "auth_session_indicator=true; path=/; max-age=31536000; SameSite=Lax";
    }
    try {
        localStorage.setItem(SESSION_HINT_KEY, '1');
    } catch {
        // Ignore storage quota / private mode errors
    }
}

function clearAuthCookie() {
    if (typeof document !== 'undefined') {
        document.cookie = "auth_session_indicator=; path=/; max-age=0; SameSite=Lax";
    }
    try {
        localStorage.removeItem(SESSION_HINT_KEY);
    } catch {
        // Ignore storage errors
    }
}

export async function initAuth() {
    console.log("Auth init started (Global)");
    try {
      const currentUser = await auth.getCurrentUser();
      
      if (currentUser) {
        setAuthCookie();
        const teamsList = await auth.getTeams();
        const owned = await auth.getOwnedTeam(currentUser.$id);
        
        // Restore active team
        const storedTeamId = localStorage.getItem('activeTeamId');
        let active: Models.Team | null = null;
        if (storedTeamId) {
            active = teamsList.find(t => t.$id === storedTeamId) || null;
        }

        // Enforce Team Selection (No Personal Inventory)
        if (!active && teamsList.length > 0) {
            active = teamsList[0];
            localStorage.setItem('activeTeamId', active.$id);
        }

        authStore.set({
          user: currentUser,
          isAuthenticated: true,
          isPartner: currentUser.labels.includes("partner"),
          teams: teamsList,
          ownedTeam: owned,
          currentTeam: active,
          loading: false
        });
        
        isAlphaMode.set(currentUser.labels?.includes("alpha") || false);
        
        // Dispatch
        if (active) {
            window.dispatchEvent(new CustomEvent('team-changed', { detail: { teamId: active.$id } }));
        }

      } else {
        clearAuthCookie();
        authStore.setKey('loading', false);
        redirectGuestToLogin();
      }
    } catch (error) {
      console.error("Auth init error:", error);
      authStore.setKey('loading', false);
    }
}

// Client-side backstop for the server middleware: if the Appwrite session is gone
// (expired / cleared) while on a member-only page, send the visitor to /login.
function redirectGuestToLogin() {
    if (typeof window === 'undefined') return;
    const { pathname, search } = window.location;
    if (!isPublicPagePath(pathname)) {
        window.location.replace(buildLoginRedirect(pathname, search));
    }
}

export async function register(email: string, pass: string, name: string) {
    await auth.register(email, pass, name);
    await initAuth();
}

export async function login(email: string, pass: string) {
    await auth.login(email, pass);
    await initAuth();
}

export async function logout() {
    try {
        await auth.logout();
    } finally {
        clearAuthCookie();
        authStore.set({
          user: null,
          isAuthenticated: false,
          isPartner: false,
          teams: [],
          currentTeam: null,
          ownedTeam: null,
          loading: false
        });
        try {
            localStorage.removeItem('activeTeamId');
        } catch {
            // Ignore storage errors
        }
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    }
}

export async function switchTeam(team: Models.Team | null) {
     authStore.setKey('currentTeam', team);
     if (team) {
         localStorage.setItem('activeTeamId', team.$id);
     } else {
         localStorage.removeItem('activeTeamId');
     }
     window.dispatchEvent(new CustomEvent('team-changed', { detail: { teamId: team ? team.$id : null } }));
}

export async function createTeam(name: string) {
      const newTeam = await auth.createTeam(name);
      const teamsList = await auth.getTeams();
      authStore.setKey('teams', teamsList);
      authStore.setKey('ownedTeam', newTeam);
      switchTeam(newTeam);
}

export async function inviteMember(teamId: string, email: string) {
      await auth.inviteMember(teamId, email);
}

export async function updateName(name: string) {
      const updatedUser = await auth.updateName(name);
      authStore.setKey('user', updatedUser);
}

export async function updatePrefs(prefs: Models.Preferences) {
      const updatedUser = await auth.updatePrefs(prefs);
      authStore.setKey('user', updatedUser);
}

export async function updateTeamPrefs(teamId: string, prefs: any) {
      const updatedPrefs = await auth.updateTeamPrefs(teamId, prefs);
      
      // Update the team in the teams list
      const currentTeams = authStore.get().teams;
      const index = currentTeams.findIndex((t: any) => t.$id === teamId);
      if (index !== -1) {
          const newTeams = [...currentTeams];
          newTeams[index] = { ...newTeams[index], prefs: updatedPrefs };
          authStore.setKey('teams', newTeams);
      }
      
      // Update currentTeam if it's the one being modified
      const current = authStore.get().currentTeam;
      if (current && (current.$id === teamId || !current.$id)) {
          authStore.setKey('currentTeam', { ...current, $id: teamId, prefs: updatedPrefs });
      }
      
      return updatedPrefs;
}

export async function updateEmail(email: string, pass: string) {
      const updatedUser = await auth.updateEmail(email, pass);
      authStore.setKey('user', updatedUser);
}

export async function updatePassword(pass: string, oldPass: string) {
      await auth.updatePassword(pass, oldPass);
}
