import { map } from 'nanostores';
import type { Models } from 'appwrite';
import { auth } from './auth';
import { isAlphaMode } from '../stores/env';

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


function setAuthCookie() {
    document.cookie = "auth_session_indicator=true; path=/; max-age=31536000; SameSite=Lax";
}

function clearAuthCookie() {
    document.cookie = "auth_session_indicator=; path=/; max-age=0; SameSite=Lax";
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
      }
    } catch (error) {
      console.error("Auth init error:", error);
      authStore.setKey('loading', false);
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
    await auth.logout();
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
    localStorage.removeItem('activeTeamId');
    window.location.href = '/login';
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

export async function updateEmail(email: string, pass: string) {
      const updatedUser = await auth.updateEmail(email, pass);
      authStore.setKey('user', updatedUser);
}

export async function updatePassword(pass: string, oldPass: string) {
      await auth.updatePassword(pass, oldPass);
}
