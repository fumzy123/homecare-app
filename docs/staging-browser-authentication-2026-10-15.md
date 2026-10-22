# Staging browser authentication checks

Completed October 15, 2026. The browser authentication walkthrough passed: signup and confirmation, admin sign-in and session persistence, worker invitation setup and welcome, worker/admin separation, sign-out, and password recovery through fresh sign-in. Stale-session routing, unusable email-link handling and confirmation-field validation were corrected and deployed to staging. This completes the covered browser authentication checks, not Android device acceptance or production release sign-off.

## Fixes deployed to staging

Commit `55fbf3cf6ed868ac89fec32423c33cd410af58a6` is deployed on the staging branch and [verified preview](https://homecare-430ims2vb-fumezs-projects.vercel.app). Production was not changed.

- Registration previously trusted the persisted application token. With a deleted account's stale token, clicking Create an account returned to sign-in. Registration now verifies the identity with Supabase and routes valid returning users through the existing workspace gate.
- A consumed recovery link returned to the staging homepage with an authentication error in its URL but no visible explanation. The homepage now presents a generic unusable-link explanation and links to password recovery, confirmation, invitation setup and sign-in.
- The reset screen previously stayed on Verifying your reset link when no recovery session existed and could miss a recovery event emitted before mounting. It now verifies the restored identity, offers another reset link when unavailable and removes password entry on sign-out. The page no longer claims identity verification before verification succeeds.

Nine focused component/routing checks passed, as did lint on the changed files, the frontend build and [Frontend CI](https://github.com/fumzy123/homecare-app/actions/runs/38751685964). Browser checks confirmed the deployed unusable-link page and the missing-session reset message.

### Confirmation validation follow-up

During the recovery handoff, the user found that a mismatch error stayed visible when editing only the new-password field to match confirmation. The new regression test reproduced that failure. Commit `6eccb3214f7f52d9fb781bbec343b5bedd4bd8cc` links confirmation validation to changes in the password field, clearing resolved mismatches and detecting newly introduced ones. The regression also verifies mismatched submission never calls the password update API. All 10 focused authentication tests, changed-component lint, the frontend build and [Frontend CI](https://github.com/fumzy123/homecare-app/actions/runs/38757621449) passed. The commit was pushed only to staging; deployment 7096383087 succeeded at https://homecare-gvqkjtxzn-fumezs-projects.vercel.app. The exact mismatch sequence was verified by the regression test; no second live password change was required.

On returning to the browser after this fix, the workspace gate showed a recoverable access-check error. Clicking Try again opened the expected admin dashboard. The reset success message itself was not observed by the agent. Recovery was instead verified by signing out, observing rejection of the old password, and then observing the correct admin dashboard after the user signed in with the new password. The temporary workspace-check error did not recur on that fresh sign-in; its original cause was not established.

The final fresh sign-in opened Fictional Browser Owner's dashboard with the expected single fictional worker. The new password was entered only by the user and was not recorded in the report or test state.

The changes do not modify the separate, uncommitted confirmation UI or billing work in this checkout. Those changes require a separate deployment and acceptance pass if included in release.

## Browser coverage

| Check | Status |
| --- | --- |
| Previously deleted test identity cannot enter the protected workspace | Passed; returned to sign-in |
| Stale application token must not prevent registration | Regression corrected and deployed; fresh signed-out canonical registration displayed |
| Existing valid account resolves through invitation account checking | Passed; existing account identified as ready |
| Sign-out updates invitation screen to unauthenticated guidance | Passed |
| Recovery reachable before sign-in | Passed |
| Malformed recovery email rejected in the form | Passed |
| Used/expired link explains failure and offers recovery paths | Passed after fix |
| Reset page without valid session terminates loading with another-link action | Passed after fix |
| Successful signup, confirmation and agency creation through browser | Passed; user completed signup/confirmation, agent signed in and verified Fictional Browser Owner dashboard |
| Returning session after page reload | Passed; admin dashboard retained |
| Incorrect password rejected on registered test account | Passed; Invalid login credentials displayed |
| Worker sign-out returns to sign-in | Passed |
| Worker invitation created through admin UI and email delivered | Passed; dedicated worker alias shows Pending, delivery confirmed |
| Invitation link opens the correct agency and worker setup form | Passed; actual delivered link consumed in browser |
| Invitation password setup and welcome through browser | Passed; user submitted setup, account-ready page names the correct agency and provides the worker-app link |
| Worker cannot enter admin dashboard | Passed; direct dashboard navigation shows worker-only access guidance, no admin records |
| Recovery password update and subsequent sign-in through browser | Passed; user performed password entry/submission and fresh sign-in; agent verified the expected admin dashboard |
| Previous admin password rejected after user recovery interaction | Passed; browser returned Invalid login credentials for the formerly valid test password |
| Recovery requested while signed out, delivered, and link opens reset form | Passed; actual delivered link opened on canonical staging |

## Test identity and retained fixture

The user completed registration and email confirmation on the canonical staging site for DISPOSABLE Browser Auth 68276d5a using a unique alias of the authorized Gmail inbox. The agent used the supplied existing test credential to verify successful sign-in. Browser control requires the user to perform new credential entry and password-change submission. A separate worker alias was invited through the admin UI; delivery and Pending status were verified.

The prior staging browser session was signed out through the application's normal control to allow fresh registration. Existing account data was not deleted. The fictional agency DISPOSABLE Browser Auth 68276d5a and its admin/worker aliases are retained for the upcoming Android checks, avoiding another invitation/password setup. Clean up this specific fixture after device acceptance; do not delete the user's existing staging accounts.

The user completed worker password setup. The account-ready screen identified the test agency and provided the worker-app link. Direct navigation to the admin dashboard showed worker-only guidance; sign-out returned to login. An intentionally wrong password on the registered admin test account produced Invalid login credentials. Recovery was requested while signed out; delivery, the reset form, old-password rejection and fresh new-password sign-in were verified. No authentication handoff remains pending.

The worker-only admin-access screen still says the app is coming to iOS and Android and promises an email. Authorization behaved correctly; this older copy should be aligned with the actual Android rollout before release.

Screenshots are retained locally in `.cache/browser-auth-signup-handoff.jpg`, `.cache/browser-auth-expired-link-fixed.jpg`, `.cache/browser-auth-missing-reset-fixed.jpg`, `.cache/browser-auth-admin-confirmed.jpg`, `.cache/browser-auth-worker-setup-handoff.jpg`, `.cache/browser-auth-worker-ready.jpg` and `.cache/browser-auth-recovery-complete.jpg`. These contain fictional test details, not passwords.
