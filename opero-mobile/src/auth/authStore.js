import * as SecureStore from "expo-secure-store";
const TOKEN_KEY = "opero_jwt";

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (t) => SecureStore.setItemAsync(TOKEN_KEY, t);
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);
