import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../models/user_model.dart';

const String _hospitalName = 'MedTrace General Hospital';
const String _webClientId = '748089157977-l405m5fu6iha18tkdb4l2hhgml6l3jdp.apps.googleusercontent.com';

class AuthResult {
  final bool success;
  final String message;
  final UserModel? user;

  AuthResult({
    required this.success,
    required this.message,
    this.user,
  });
}

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final GoogleSignIn _googleSignIn = GoogleSignIn(
    clientId: kIsWeb ? _webClientId : null,
  );


  // ── Helper: map Firebase error codes to human-readable messages ──────────────
  String _firebaseError(String code) {
    switch (code) {
      case 'email-already-in-use':
        return 'An account with this email address already exists.';
      case 'invalid-email':
        return 'Please enter a valid email address.';
      case 'weak-password':
        return 'Password must be at least 6 characters.';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'Invalid email or password credentials.';
      case 'too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'network-request-failed':
        return 'Network error. Please check your connection.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  // ── Helper: fetch Firestore profile ──────────────────────────────────────────
  Future<UserModel?> fetchUserProfile(String uid) async {
    try {
      final doc = await _firestore.collection('users').doc(uid).get();
      if (doc.exists) {
        return UserModel.fromJson({'id': uid, ...doc.data()!});
      }
    } catch (_) {}
    return null;
  }

  // ── Register with Email & Password ───────────────────────────────────────────
  Future<AuthResult> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String role,
  }) async {
    try {
      // 1. Create Firebase Auth user
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email.trim().toLowerCase(),
        password: password,
      );
      final uid = credential.user!.uid;

      // 2. Update display name in Firebase Auth
      await credential.user!.updateDisplayName(name);

      // 3. Save extended profile to Firestore
      final profileData = {
        'name': name,
        'email': email.trim().toLowerCase(),
        'phone': phone,
        'hospitalName': _hospitalName,
        'role': role,
        'createdAt': FieldValue.serverTimestamp(),
      };
      await _firestore.collection('users').doc(uid).set(profileData);

      final user = UserModel(
        id: uid,
        name: name,
        email: email.trim().toLowerCase(),
        phone: phone,
        hospitalName: _hospitalName,
        role: role,
      );

      return AuthResult(success: true, message: 'Account created successfully', user: user);
    } on FirebaseAuthException catch (e) {
      return AuthResult(success: false, message: _firebaseError(e.code));
    } catch (e) {
      return AuthResult(success: false, message: 'Registration failed: $e');
    }
  }

  // ── Login with Email & Password ──────────────────────────────────────────────
  Future<AuthResult> login({
    required String email,
    required String password,
    bool rememberMe = false,
  }) async {
    try {
      await _auth.setPersistence(
        rememberMe ? Persistence.LOCAL : Persistence.SESSION,
      );

      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim().toLowerCase(),
        password: password,
      );

      final user = await fetchUserProfile(credential.user!.uid);
      if (user == null) {
        return AuthResult(success: false, message: 'User profile not found. Please re-register.');
      }

      return AuthResult(success: true, message: 'Login successful', user: user);
    } on FirebaseAuthException catch (e) {
      return AuthResult(success: false, message: _firebaseError(e.code));
    } catch (e) {
      return AuthResult(success: false, message: 'Login failed: $e');
    }
  }

  // ── Google Sign-In ───────────────────────────────────────────────────────────
  Future<AuthResult> googleAuth({String role = 'Patient'}) async {
    try {
      final UserCredential userCredential;

      if (kIsWeb) {
        final GoogleAuthProvider googleProvider = GoogleAuthProvider();
        googleProvider.addScope('email');
        googleProvider.addScope('profile');
        userCredential = await _auth.signInWithPopup(googleProvider);
      } else {
        final googleUser = await _googleSignIn.signIn();
        if (googleUser == null) {
          return AuthResult(success: false, message: 'Google Sign-In was cancelled.');
        }

        final googleAuth = await googleUser.authentication;
        final credential = GoogleAuthProvider.credential(
          accessToken: googleAuth.accessToken,
          idToken: googleAuth.idToken,
        );

        userCredential = await _auth.signInWithCredential(credential);
      }

      final uid = userCredential.user!.uid;

      // Check if Firestore profile exists
      UserModel? user = await fetchUserProfile(uid);

      if (user == null) {
        // New Google user — create profile
        final profileData = {
          'name': userCredential.user!.displayName ?? 'Google User',
          'email': userCredential.user!.email ?? '',
          'phone': userCredential.user!.phoneNumber ?? '',
          'hospitalName': _hospitalName,
          'role': role,
          'createdAt': FieldValue.serverTimestamp(),
        };
        await _firestore.collection('users').doc(uid).set(profileData);

        user = UserModel(
          id: uid,
          name: profileData['name'] as String,
          email: profileData['email'] as String,
          phone: profileData['phone'] as String,
          hospitalName: _hospitalName,
          role: role,
        );
      }

      return AuthResult(success: true, message: 'Google authentication successful', user: user);
    } on FirebaseAuthException catch (e) {
      return AuthResult(success: false, message: _firebaseError(e.code));
    } catch (e) {
      return AuthResult(success: false, message: 'Google Sign-In failed: $e');
    }
  }


  // ── Forgot Password ───────────────────────────────────────────────────────────
  Future<AuthResult> forgotPassword(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim().toLowerCase());
      return AuthResult(success: true, message: 'Password reset email sent! Check your inbox.');
    } on FirebaseAuthException catch (e) {
      return AuthResult(success: false, message: _firebaseError(e.code));
    } catch (e) {
      return AuthResult(success: false, message: 'Failed to send reset email.');
    }
  }

  // ── Get current user from Firebase Auth state ─────────────────────────────────
  Future<UserModel?> getSavedUser() async {
    final firebaseUser = _auth.currentUser;
    if (firebaseUser != null) {
      return fetchUserProfile(firebaseUser.uid);
    }
    return null;
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  Future<void> logout() async {
    await _googleSignIn.signOut();
    await _auth.signOut();
  }

  // ── Auth state stream ─────────────────────────────────────────────────────────
  Stream<User?> get authStateChanges => _auth.authStateChanges();
}

