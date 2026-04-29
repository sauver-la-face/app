 ---                                                                                                                                                                                                             
  Routes auth — http://localhost:3001                                                                                                                                                                             
                                                                                                                                                                                                                  
  Inscription d'un médecin                                                                                                                                                                                        
                                                                                                                                                                                                                  
  POST /api/auth/sign-up/email                                                                                                                                                                                    
  Content-Type: application/json                                                                                                                                                                                  
                                                                                                                                                                                                                  
  {                                                                                                                                                                                                               
    "email": "medecin@example.com",                                                                                                                                                                               
    "password": "MonMotDePasse123!",
    "name": "Dr. Dupont"
  }

  Connexion

  POST /api/auth/sign-in/email
  Content-Type: application/json

  {
    "email": "medecin@example.com",
    "password": "MonMotDePasse123!"
  }
  → Retourne { user, session } et set le cookie sauver-la-face.session_token

  Déconnexion

  POST /api/auth/sign-out
  Cookie: sauver-la-face.session_token=<token>

  Session courante

  GET /api/auth/get-session
  Cookie: sauver-la-face.session_token=<token>

  2FA — Activer (génère le QR code)

  POST /api/auth/two-factor/enable
  Cookie: sauver-la-face.session_token=<token>
  Content-Type: application/json

  { "password": "MonMotDePasse123!" }
  → Retourne { totpURI, backupCodes } — scanner totpURI dans Google Authenticator

  2FA — Vérifier le code TOTP (finalise l'activation)

  POST /api/auth/two-factor/verify-totp
  Cookie: sauver-la-face.session_token=<token>
  Content-Type: application/json

  { "code": "123456" }

  Santé

  GET /api/auth/ok
