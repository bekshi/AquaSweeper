import React, { createContext, useState, useEffect } from "react";
import auth from "@react-native-firebase/auth";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((user) => {
      setUser(user);
    });

    return () => unsubscribe();
  }, []);

  const signUp = async (email, password, additionalData) => {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password
      );
      const uid = userCredential.user.uid;

      await firebase
        .firestore()
        .collection("users")
        .doc(uid)
        .set({
          ...additionalData,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

      return uid;
    } catch (error) {
      console.error("Sign-up error:", error.message);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};
