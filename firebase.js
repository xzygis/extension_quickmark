window.FirebaseAuth = {
  async init() {
    const response = await chrome.runtime.sendMessage({ action: 'firebase_init' });
    if (response.error) throw new Error(response.error);
    return response.user;
  },
  
  async signInWithGoogle() {
    const response = await chrome.runtime.sendMessage({ action: 'firebase_signIn' });
    if (response.error) throw new Error(response.error);
    return response.user;
  },
  
  async signOut() {
    const response = await chrome.runtime.sendMessage({ action: 'firebase_signOut' });
    if (response.error) throw new Error(response.error);
    return response.success;
  },
  
  async getCurrentUser() {
    const response = await chrome.runtime.sendMessage({ action: 'firebase_getCurrentUser' });
    return response.user;
  },
  
  async performSync() {
    const response = await chrome.runtime.sendMessage({ action: 'firebase_performSync' });
    if (response.error) throw new Error(response.error);
    return response.result;
  },
  
  async shouldAutoSync() {
    const response = await chrome.runtime.sendMessage({ action: 'firebase_shouldAutoSync' });
    if (response.error) throw new Error(response.error);
    return response.should;
  }
};
