import { account, teams, ID, Query } from './appwrite';
import type { Models } from 'appwrite';

export interface AuthState {
  isAuthenticated: boolean;
  user: Models.User<Models.Preferences> | null;
  isPartner: boolean;
  loading: boolean;
}

export const auth = {
  async login(email: string, password: string) {
    try {
      await account.createEmailPasswordSession(email, password);
      return await this.getCurrentUser();
    } catch (error: any) {
      if (error?.message?.includes('session is active')) {
         console.log('Session already active. Attempting to get current user.');
         const user = await this.getCurrentUser();
         if (user) return user;
         
         // If we can't get the user but a session is active, delete it and retry
         console.log('Deleting stuck session and retrying...');
         try {
             await account.deleteSession('current');
             await account.createEmailPasswordSession(email, password);
             return await this.getCurrentUser();
         } catch (retryError) {
             console.error('Login retry error:', retryError);
             throw retryError;
         }
      }
      console.error('Login error:', error);
      throw error;
    }
  },

  async register(email: string, password: string, name: string) {
    try {
      await account.create(ID.unique(), email, password, name);
      return await this.login(email, password);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  async logout() {
    try {
      await account.deleteSession('current');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always cleanup local state if possible here, or let the caller handle it
    }
  },

  async getCurrentUser(): Promise<Models.User<Models.Preferences> | null> {
    try {
      return await account.get();
    } catch (error) {
      // Not logged in
      return null;
    }
  },

  async isPartner(user: Models.User<Models.Preferences> | null): Promise<boolean> {
    if (!user) return false;
    // Check for "partner" label
    return user.labels?.includes('partner') || false;
  },

  async isAlpha(user: Models.User<Models.Preferences> | null): Promise<boolean> {
    if (!user) return false;
    // Check for "alpha" label
    return user.labels?.includes('alpha') || false;
  },

  async getTeams() {
      try {
          const response = await teams.list();
          return response.teams;
      } catch (error) {
          console.error("Error fetching teams:", error);
          return [];
      }
  },

  async getOwnedTeam(userId: string) {
      try {
          const allTeams = await this.getTeams();
          for (const team of allTeams) {
              try {
                  const response = await teams.listMemberships(team.$id);
                  const myMembership = response.memberships.find(m => m.userId === userId);
                  if (myMembership && myMembership.roles.includes('owner')) {
                      return team;
                  }
              } catch (e) {
                  // Ignore error for specific team check (e.g. if we left team concurrently?)
                  console.warn(`Failed to checking membership for team ${team.$id}`, e);
              }
          }
          return null;
      } catch (error) {
           console.error("Error getting owned team:", error);
           return null;
      }
  },

  async createTeam(name: string) {
      try {
          // Check if user already owns a team
          const user = await this.getCurrentUser();
          if (!user) throw new Error("User not logged in");
          
          const ownedTeam = await this.getOwnedTeam(user.$id);
          if (ownedTeam) {
              throw new Error(`You can only own one organization. You already own: ${ownedTeam.name}`);
          }

          return await teams.create(ID.unique(), name);
      } catch (error) {
          console.error("Error creating team:", error);
          throw error;
      }
  },

  async inviteMember(teamId: string, email: string) {
      try {
          // Construct absolute URL for the join page
          const url = `${window.location.origin}/join`;
          // 'member' is the default role. 
          // Appwrite params: teamId, roles, email, userId, phone, url, name
          return await teams.createMembership(teamId, ['member'], email, ID.unique(), undefined, url);
      } catch (error) {
          console.error("Error inviting member:", error);
          throw error;
      }
  },

  async acceptInvite(teamId: string, membershipId: string, userId: string, secret: string) {
      try {
          return await teams.updateMembershipStatus(teamId, membershipId, userId, secret);
      } catch (error) {
          console.error("Error accepting invite:", error);
          throw error;
      }
  },

  async updateName(name: string) {
      try {
          return await account.updateName(name);
      } catch (error) {
          console.error("Error updating name:", error);
          throw error;
      }
  },

  async updatePrefs(prefs: Models.Preferences) {
      try {
          return await account.updatePrefs(prefs);
      } catch (error) {
          console.error("Error updating prefs:", error);
          throw error;
      }
  },

  async updateEmail(email: string, pass: string) {
      try {
          return await account.updateEmail(email, pass);
      } catch (error) {
          console.error("Error updating email:", error);
          throw error;
      }
  },

  async updatePassword(pass: string, oldPass: string) {
      try {
          return await account.updatePassword(pass, oldPass);
      } catch (error) {
          console.error("Error updating password:", error);
          throw error;
      }
  }
};
