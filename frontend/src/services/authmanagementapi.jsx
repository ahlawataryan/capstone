import { ManagementClient } from 'auth0';

//Delete a user with their email. Provided email will get the user id, then the associated user id will be deleted
//I don't think this is the best option by any means, but it's the problem of our implementation relying on emails
//I might have configured it to prevent duplicate emails anyways
export async function deleteAuthUserByEmail(userEmail) {
    try{
        const response = await fetch('http://localhost:5000/api/authmgt', {
        mode: 'cors',
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          "email": userEmail
        }),
      });

      if (!response.ok) {
          throw new Error('Network response was not ok');
      }

    } catch (err) {
        console.error(err);
    }
}