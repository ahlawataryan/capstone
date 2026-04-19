import { ManagementClient } from 'auth0';

//Get tokens to access the management API. Data returned contains an "access_token" field to be used with api calls
async function getToken() {
  try {
      const response = await fetch('https://dev-6qyiyqksmtwrjpbi.us.auth0.com/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          "client_id":import.meta.env.VITE_AUTH0_CLIENT_ID,
          "client_secret":import.meta.env.VITE_AUTH0_CLIENT_SECRET,
          "audience":"https://dev-6qyiyqksmtwrjpbi.us.auth0.com/api/v2/",
          "grant_type":"client_credentials"
        }),
      });

      if (!response.ok) {
          throw new Error('Network response was not ok');
      }

      const data = await response.json();
      return data.access_token;
  } catch (error) {
      console.error('Error fetching token:', error);
  }
};

//Delete a user with their email. Provided email will get the user id, then the associated user id will be deleted
//I don't think this is the best option by any means, but it's the problem of our implementation relying on emails
//I might have configured it to prevent duplicate emails anyways
async function deleteAuthUserByEmail(userEmail) {
    try{
        const client = new ManagementClient({
            token: getToken(),
        });
        let user = await client.users.listUsersByEmail({
            email: userEmail,
        });
        if(user){
            await client.users.delete(user.user_id);
        }
    } catch (err) {
        console.error(err);
    }
}