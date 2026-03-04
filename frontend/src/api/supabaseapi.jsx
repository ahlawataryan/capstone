import { supabase } from "../supabaseconfig.js";/*
File to contain wrapper functions that can call supabase functions. 
Supabase configured in supabaseconfig.js
Supabase installed on system using scoop in command line
Supabase commands to retrieve and set up database. Connection should be made already,
so these are for set up. Need docker desktop running
supabase start
supabase migration up
supabase push
supabase pull
Dependencies:
supabase
supabase-js
*/

/*
User definition
create table "users" (
  "user_id" bigint generated always as identity primary key,
  "email" text unique,
  "role" text default 'customer',
  "first_name" text,
  "last_name" text,
  "phone" text,
  "bio" text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
*/

//Get user by email. For initial checks and retrieval from login
//Return user set. Should be one element
//Something was going wrong with the functions, so I deleted them for now.
//Best option is likely just to use javascript commands and writing functions here


// -------------------- REVIEWS --------------------

// Get reviews for a student (latest first)
export async function getReviewsForStudent(studentEmail) {
  return await supabase
    .from("reviews")
    .select("id, student_email, client_email, rating, review_text, created_at")
    .eq("student_email", studentEmail)
    .order("created_at", { ascending: false });
}

// Get average rating + count for a student
export async function getReviewSummary(studentEmail) {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("student_email", studentEmail);

  if (error) return { data: null, error };

  const count = data.length;
  const avg =
    count === 0 ? 0 : data.reduce((sum, r) => sum + r.rating, 0) / count;

  return { data: { avg, count }, error: null };
}

// Create (or update) a review (uses unique index for upsert)
export async function upsertReview({ studentEmail, clientEmail, rating, reviewText }) {
  return await supabase
    .from("reviews")
    .upsert(
      {
        student_email: studentEmail,
        client_email: clientEmail,
        rating,
        review_text: reviewText,
      },
      { onConflict: "student_email,client_email" }
    )
    .select()
    .single();
}