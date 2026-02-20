/**
 * Comprehensive validation utility for all user inputs
 * Provides consistent validation across the entire app
 */

export const Validation = {
  /**
   * Validates email format
   * @param {string} email - Email to validate
   * @returns {object} { isValid: boolean, error: string|null }
   */
  email: (email) => {
    if (!email || !email.trim()) {
      return { isValid: false, error: 'Email is required' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }
    return { isValid: true, error: null };
  },

  /**
   * Validates password strength
   * @param {string} password - Password to validate
   * @param {number} minLength - Minimum length required (default: 6)
   * @returns {object} { isValid: boolean, error: string|null }
   */
  password: (password, minLength = 6) => {
    if (!password) {
      return { isValid: false, error: 'Password is required' };
    }
    if (password.length < minLength) {
      return { isValid: false, error: `Password must be at least ${minLength} characters` };
    }
    // Check for strong password (optional but recommended)
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    const isStrong = hasUpperCase && hasLowerCase && hasNumbers;
    
    return { 
      isValid: true, 
      error: null,
      isStrong, // Flag to indicate if password is strong
      warnings: isStrong ? [] : [
        !hasUpperCase && 'Add uppercase letters',
        !hasLowerCase && 'Add lowercase letters',
        !hasNumbers && 'Add numbers'
      ].filter(Boolean)
    };
  },

  /**
   * Validates name field
   * @param {string} name - Name to validate
   * @returns {object} { isValid: boolean, error: string|null }
   */
  name: (name) => {
    if (!name || !name.trim()) {
      return { isValid: false, error: 'Name is required' };
    }
    if (name.trim().length < 2) {
      return { isValid: false, error: 'Name must be at least 2 characters' };
    }
    if (name.trim().length > 50) {
      return { isValid: false, error: 'Name must be less than 50 characters' };
    }
    return { isValid: true, error: null };
  },

  /**
   * Validates that two values match (e.g., password confirmation)
   * @param {string} value1 - First value
   * @param {string} value2 - Second value
   * @param {string} fieldName - Field name for error message
   * @returns {object} { isValid: boolean, error: string|null }
   */
  match: (value1, value2, fieldName = 'Passwords') => {
    if (value1 !== value2) {
      return { isValid: false, error: `${fieldName} do not match` };
    }
    return { isValid: true, error: null };
  },

  /**
   * Validates mood/emotion input
   * @param {string} mood - Mood to validate
   * @returns {object} { isValid: boolean, error: string|null }
   */
  mood: (mood) => {
    const validMoods = ['happy', 'sad', 'anxious', 'calm', 'stressed', 'neutral'];
    if (!mood) {
      return { isValid: false, error: 'Please select a mood' };
    }
    if (!validMoods.includes(mood.toLowerCase())) {
      return { isValid: false, error: 'Invalid mood selection' };
    }
    return { isValid: true, error: null };
  },

  /**
   * Validates mood intensity (0-10 scale)
   * @param {number} intensity - Intensity to validate
   * @returns {object} { isValid: boolean, error: string|null }
   */
  intensity: (intensity) => {
    const num = Number(intensity);
    if (isNaN(num)) {
      return { isValid: false, error: 'Intensity must be a number' };
    }
    if (num < 0 || num > 10) {
      return { isValid: false, error: 'Intensity must be between 0 and 10' };
    }
    return { isValid: true, error: null };
  },

  /**
   * Validates check-in message
   * @param {string} message - Message to validate
   * @returns {object} { isValid: boolean, error: string|null }
   */
  checkInMessage: (message) => {
    if (!message || !message.trim()) {
      return { isValid: false, error: 'Please write something' };
    }
    if (message.trim().length < 10) {
      return { isValid: false, error: 'Message must be at least 10 characters' };
    }
    if (message.trim().length > 500) {
      return { isValid: false, error: 'Message must be less than 500 characters' };
    }
    return { isValid: true, error: null };
  },

  /**
   * Validates chat message
   * @param {string} message - Chat message to validate
   * @returns {object} { isValid: boolean, error: string|null }
   */
  chatMessage: (message) => {
    if (!message || !message.trim()) {
      return { isValid: false, error: 'Message cannot be empty' };
    }
    if (message.trim().length > 1000) {
      return { isValid: false, error: 'Message is too long' };
    }
    return { isValid: true, error: null };
  },

  /**
   * Validates all signup fields together
   * @param {object} data - { name, email, password, confirmPassword }
   * @returns {object} { isValid: boolean, errors: {} }
   */
  signup: (data) => {
    const errors = {};

    const nameValidation = Validation.name(data.name);
    if (!nameValidation.isValid) errors.name = nameValidation.error;

    const emailValidation = Validation.email(data.email);
    if (!emailValidation.isValid) errors.email = emailValidation.error;

    const passwordValidation = Validation.password(data.password);
    if (!passwordValidation.isValid) errors.password = passwordValidation.error;

    const matchValidation = Validation.match(data.password, data.confirmPassword, 'Passwords');
    if (!matchValidation.isValid) errors.confirmPassword = matchValidation.error;

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },

  /**
   * Validates all login fields together
   * @param {object} data - { email, password }
   * @returns {object} { isValid: boolean, errors: {} }
   */
  login: (data) => {
    const errors = {};

    const emailValidation = Validation.email(data.email);
    if (!emailValidation.isValid) errors.email = emailValidation.error;

    const passwordValidation = Validation.password(data.password);
    if (!passwordValidation.isValid) errors.password = passwordValidation.error;

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  },
};

/**
 * Error handler utility for consistent error messages
 */
export const ErrorHandler = {
  /**
   * Handles API errors and returns user-friendly message
   * @param {Error} error - The error object
   * @returns {string} User-friendly error message
   */
  getMessageFromError: (error) => {
    if (!error) {
      return 'An unexpected error occurred';
    }

    // Network errors
    if (error.message === 'Network request failed') {
      return 'No internet connection. Please check your network.';
    }

    // API response errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 400:
          return data.message || 'Invalid request. Please check your input.';
        case 401:
          return 'Invalid email or password. Please try again.';
        case 403:
          return 'Access denied. Please try logging in again.';
        case 404:
          return 'Resource not found.';
        case 409:
          return data.message || 'Email already registered. Please use a different email.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
          return 'Server error. Please try again later.';
        case 503:
          return 'Service unavailable. Please try again later.';
        default:
          return data.message || `Error (${status}). Please try again.`;
      }
    }

    // Generic errors
    if (error.message) {
      return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  },

  /**
   * Determines if error is network related
   * @param {Error} error - The error object
   * @returns {boolean}
   */
  isNetworkError: (error) => {
    return error?.message === 'Network request failed' || 
           error?.code === 'ECONNREFUSED' ||
           error?.code === 'ENOTFOUND';
  },

  /**
   * Determines if error is authentication related
   * @param {Error} error - The error object
   * @returns {boolean}
   */
  isAuthError: (error) => {
    return error?.response?.status === 401 || error?.response?.status === 403;
  },

  /**
   * Determines if we can retry the operation
   * @param {Error} error - The error object
   * @returns {boolean}
   */
  isRetryable: (error) => {
    if (!error?.response) return true; // Network errors are retryable
    const status = error.response.status;
    return status === 408 || status === 429 || status >= 500;
  },
};
