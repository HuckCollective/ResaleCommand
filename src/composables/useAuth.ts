import { useStore } from '@nanostores/vue';
import { 
  authStore, 
  initAuth, 
  login as loginAction, 
  register as registerAction,
  logout as logoutAction, 
  switchTeam as switchTeamAction, 
  createTeam as createTeamAction, 
  inviteMember as inviteMemberAction,
  updateName as updateNameAction,
  updateEmail as updateEmailAction,
  updatePassword as updatePasswordAction,
  updatePrefs as updatePrefsAction,
  updateTeamPrefs as updateTeamPrefsAction
} from '../lib/store';
import { computed } from 'vue';

export function useAuth() {
  const state = useStore(authStore);

  // Computed Properties
  const user = computed(() => state.value.user);
  const isAuthenticated = computed(() => state.value.isAuthenticated);
  const isPartner = computed(() => state.value.isPartner);
  const teams = computed(() => state.value.teams);
  const currentTeam = computed(() => state.value.currentTeam);
  const ownedTeam = computed(() => state.value.ownedTeam);
  const loading = computed(() => state.value.loading);
  const isAdmin = computed(() => {
    if (!state.value.user) return false;
    return !!state.value.ownedTeam || 
           !!state.value.user.labels?.includes('admin') ||
           state.value.isPartner;
  });

  return {
    // State
    user,
    isAuthenticated,
    isPartner,
    isAdmin,
    teams,
    currentTeam,
    ownedTeam,
    loading,
    
    // Actions
    init: initAuth,
    login: loginAction,
    register: registerAction,
    logout: logoutAction,
    switchTeam: switchTeamAction,
    createTeam: createTeamAction,
    inviteMember: inviteMemberAction,
    updateName: updateNameAction,
    updateEmail: updateEmailAction,
    updatePassword: updatePasswordAction,
    updatePrefs: updatePrefsAction,
    updateTeamPrefs: updateTeamPrefsAction
  };
}
