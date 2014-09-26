# NodeBB Linkedin SSO

NodeBB Plugin that allows users to login/register via their Linkedin account.

## Installation

    npm install nodebb-plugin-sso-linkedin

## Configuration

1. Create a **Linkedin Application** via the [API Console](https://www.linkedin.com/secure/developer)
2. Locate your API Key and Secret Key
3. Check the 'r_basicprofile' and 'r_emailaddress' checkboxes
4. Set your "OAuth 1.0 Accept Redirect URL" as the domain you access your NodeBB with `/auth/linkedin/callback` appended to it (e.g. `https://forum.mygreatwebsite.com/auth/linkedin/callback`)
5. Drink beer...