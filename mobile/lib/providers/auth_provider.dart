import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();

  UserModel? _currentUser;
  bool _isLoading = true;
  String? _errorMessage;
  StreamSubscription<User?>? _authSubscription;

  UserModel? get currentUser => _currentUser;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _currentUser != null;
  String? get errorMessage => _errorMessage;

  AuthProvider() {
    _initAuthListener();
  }

  // ── Listen to Firebase auth state changes ──────────────────────────────────
  void _initAuthListener() {
    try {
      _authSubscription = _authService.authStateChanges.listen((firebaseUser) async {
        if (firebaseUser != null) {
          _currentUser = await _authService.fetchUserProfile(firebaseUser.uid);
        } else {
          _currentUser = null;
        }
        _isLoading = false;
        notifyListeners();
      }, onError: (err) {
        _isLoading = false;
        notifyListeners();
      });
    } catch (_) {
      _isLoading = false;
      notifyListeners();
    }
  }


  @override
  void dispose() {
    _authSubscription?.cancel();
    super.dispose();
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  Future<bool> login(String email, String password, {bool rememberMe = false}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    final result = await _authService.login(
      email: email,
      password: password,
      rememberMe: rememberMe,
    );
    _isLoading = false;

    if (result.success && result.user != null) {
      _currentUser = result.user;
      notifyListeners();
      return true;
    } else {
      _errorMessage = result.message;
      notifyListeners();
      return false;
    }
  }

  // ── Register ───────────────────────────────────────────────────────────────
  Future<bool> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String role,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    final result = await _authService.register(
      name: name,
      email: email,
      phone: phone,
      password: password,
      role: role,
    );
    _isLoading = false;

    if (result.success && result.user != null) {
      _currentUser = result.user;
      notifyListeners();
      return true;
    } else {
      _errorMessage = result.message;
      notifyListeners();
      return false;
    }
  }

  // ── Google Sign-In ─────────────────────────────────────────────────────────
  Future<bool> googleSignIn({String role = 'Patient'}) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    final result = await _authService.googleAuth(role: role);
    _isLoading = false;

    if (result.success && result.user != null) {
      _currentUser = result.user;
      notifyListeners();
      return true;
    } else {
      _errorMessage = result.message;
      notifyListeners();
      return false;
    }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  Future<void> logout() async {
    await _authService.logout();
    _currentUser = null;
    notifyListeners();
  }
}

