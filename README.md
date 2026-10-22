# Medtrace

## Reception access

Reception uses the same Firebase email/password login as Admin. To provision one receptionist:

1. Create the user in Firebase Authentication with the intended email address.
2. In Firestore, open `users/{firebaseAuthUid}` for that account.
3. Set `role` to `Reception` and `status` to `approved`.
4. Keep the email in the user document aligned with the Firebase account email.
5. The user signs in at `/login` and is redirected to `/dashboard/reception`.

The app does not hardcode a receptionist email. Access is based on the authenticated Firebase UID and the `Reception` role stored in Firestore. Only an approved `Admin` or `Hospital Administrator` can change another user's role through Firestore rules.
