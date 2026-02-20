import React, { createContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { AuthService } from '../services/authService';

/**
 * AuthContext provides global authentication state and methods
 * Usage: const { user, isLoading, login, logout } = useContext(AuthContext);
 */
export const AuthContext = createContext({});

const initialState = {
  isLoading: true,
  isSignout: false,
  user: null,
  userToken: null,
  error: null,
};

export const authReducer = (state, action) => {
  switch (action.type) {
    case 'RESTORE_TOKEN':
      return {
        ...state,
        userToken: action.payload.userToken,
        user: action.payload.user,
        isLoading: false,
      };
    case 'SIGN_IN':
      return {
        ...state,
        isSignout: false,
        user: action.payload.user,
        userToken: action.payload.userToken,
        error: null,
      };
    case 'SIGN_OUT':
      return {
        ...state,
        isSignout: true,
        user: null,
        userToken: null,
        error: null,
      };
    case 'REFRESH_TOKEN':
      return {
        ...state,
        userToken: action.payload.userToken,
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const navigationRef = useRef();

  // Initialize auth state on app startup
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        // Use AuthService.hasValidSession() so it can clear dummy/test data
        const hasSession = await AuthService.hasValidSession();
        console.log('[AuthBootstrap] hasValidSession:', hasSession);

        if (hasSession) {
          const accessToken = await AuthService.getAccessToken();
          const userData = await AuthService.getUserData();
          console.log('[AuthBootstrap] restoring accessToken:', !!accessToken);
          console.log('[AuthBootstrap] restoring userData:', !!userData, userData);

          dispatch({
            type: 'RESTORE_TOKEN',
            payload: { user: userData, userToken: accessToken },
          });
        } else {
          // Ensure any leftover data is cleared and restore to unauthenticated state
          console.log('[AuthBootstrap] no valid session; restoring unauthenticated state');
          dispatch({ type: 'RESTORE_TOKEN', payload: { user: null, userToken: null } });
        }
      } catch (error) {
        console.error('Bootstrap auth error:', error);
        dispatch({ type: 'RESTORE_TOKEN', payload: { user: null, userToken: null } });
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    bootstrapAsync();
  }, []);

  // Auth context actions
  const authContext = {
    isLoading: state.isLoading,
    isSignout: state.isSignout,
    user: state.user,
    userToken: state.userToken,
    error: state.error,

    /**
     * Sign up with email, password, and name
     */
    signup: useCallback(async (email, password, name) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'CLEAR_ERROR' });

        const result = await AuthService.signup(email, password, name);
        
        dispatch({
          type: 'SIGN_IN',
          payload: { user: result.user, userToken: result.accessToken },
        });

        return { success: true, user: result.user };
      } catch (error) {
        const errorMessage = error.message || 'Signup failed';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        return { success: false, error: errorMessage };
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }, []),

    /**
     * Sign in with email and password
     */
    signin: useCallback(async (email, password) => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'CLEAR_ERROR' });

        const result = await AuthService.login(email, password);
        
        dispatch({
          type: 'SIGN_IN',
          payload: { user: result.user, userToken: result.accessToken },
        });

        return { success: true, user: result.user };
      } catch (error) {
        const errorMessage = error.message || 'Login failed';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        return { success: false, error: errorMessage };
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }, []),

    /**
     * Sign out and clear all auth data
     */
    signout: useCallback(async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true });
        await AuthService.logout();
        dispatch({ type: 'SIGN_OUT' });
        return { success: true };
      } catch (error) {
        const errorMessage = error.message || 'Logout failed';
        dispatch({ type: 'SET_ERROR', payload: errorMessage });
        return { success: false, error: errorMessage };
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    }, []),

    /**
     * Refresh access token
     */
    refreshToken: useCallback(async () => {
      try {
        const result = await AuthService.refreshAccessToken();
        dispatch({
          type: 'REFRESH_TOKEN',
          payload: { userToken: result.accessToken },
        });
        return { success: true };
      } catch (error) {
        dispatch({ type: 'SIGN_OUT' });
        return { success: false, error: error.message };
      }
    }, []),

    /**
     * Clear error messages
     */
    clearError: useCallback(() => {
      dispatch({ type: 'CLEAR_ERROR' });
    }, []),
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
};
