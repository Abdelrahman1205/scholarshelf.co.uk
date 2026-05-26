import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

export interface SupportMode {
  active: boolean;
  schoolId: string | null;
  schoolName: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: string;
  email: string | null;
  status: string;
  schoolId: string | null;
  supportMode?: SupportMode;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/sign-in", { username, password });
      return res.json();
    },
    onSuccess: (data) => {
      // Set cache directly so AuthGuard sees the user immediately on navigate.
      // invalidateQueries would blank the cache first, causing AuthGuard to
      // redirect back to /login before the refetch completes.
      queryClient.setQueryData(["/api/auth/me"], data);
    },
  });

  const signUpParentMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/sign-up-parent", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: async (data: { token: string; name: string; username: string; password: string }) => {
      const res = await apiRequest("POST", `/api/invites/${encodeURIComponent(data.token)}/accept`, {
        name: data.name,
        username: data.username,
        password: data.password,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return res.json();
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return res.json();
    },
  });

  const enterSupportMutation = useMutation({
    mutationFn: async (schoolId: string) => {
      const res = await apiRequest("POST", "/api/owner/support-mode/enter", { schoolId });
      return res.json();
    },
    onSuccess: () => {
      // Refresh user data (includes supportMode) + all school-scoped queries
      queryClient.invalidateQueries();
    },
  });

  const exitSupportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/owner/support-mode/exit");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/sign-out");
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["/api/auth/me"], null);
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    signUpParent: signUpParentMutation.mutateAsync,
    isSigningUp: signUpParentMutation.isPending,
    signUpError: signUpParentMutation.error,
    acceptInvite: acceptInviteMutation.mutateAsync,
    isAcceptingInvite: acceptInviteMutation.isPending,
    acceptInviteError: acceptInviteMutation.error,
    forgotPassword: forgotPasswordMutation.mutateAsync,
    isForgotPending: forgotPasswordMutation.isPending,
    forgotPasswordError: forgotPasswordMutation.error,
    resetPassword: resetPasswordMutation.mutateAsync,
    isResettingPassword: resetPasswordMutation.isPending,
    resetPasswordError: resetPasswordMutation.error,
    enterSupportMode: enterSupportMutation.mutateAsync,
    exitSupportMode: exitSupportMutation.mutateAsync,
    isEnteringSupport: enterSupportMutation.isPending,
    isExitingSupport: exitSupportMutation.isPending,
  };
}
