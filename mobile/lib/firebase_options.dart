import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        return web;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyAt9xVX4yqtVM1lnu-e1cYYBJcUFDpDWOk',
    appId: '1:748089157977:web:906dd8e4778bf6537c4448',
    messagingSenderId: '748089157977',
    projectId: 'medtrace-76eb8',
    authDomain: 'medtrace-76eb8.firebaseapp.com',
    storageBucket: 'medtrace-76eb8.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyAredch1MwpsZlp9808tJZjxaXfqbBWPwY',
    appId: '1:748089157977:android:0039bd2c0c04a5547c4448',
    messagingSenderId: '748089157977',
    projectId: 'medtrace-76eb8',
    storageBucket: 'medtrace-76eb8.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAt9xVX4yqtVM1lnu-e1cYYBJcUFDpDWOk',
    appId: '1:748089157977:ios:906dd8e4778bf6537c4448',
    messagingSenderId: '748089157977',
    projectId: 'medtrace-76eb8',
    storageBucket: 'medtrace-76eb8.firebasestorage.app',
    iosBundleId: 'com.example.medtraceMobile',
  );

  static const FirebaseOptions macos = ios;

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyAt9xVX4yqtVM1lnu-e1cYYBJcUFDpDWOk',
    appId: '1:748089157977:web:906dd8e4778bf6537c4448',
    messagingSenderId: '748089157977',
    projectId: 'medtrace-76eb8',
    authDomain: 'medtrace-76eb8.firebaseapp.com',
    storageBucket: 'medtrace-76eb8.firebasestorage.app',
  );
}
