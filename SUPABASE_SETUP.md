# Supabase Setup Guide

This guide will help you set up Supabase for the Operations Dashboard.

## Prerequisites

1. You already have a Supabase project created
2. The credentials are stored in `.env.local`

## Steps to Complete Setup

### 1. Create Database Tables

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy the contents of `supabase/migrations.sql`
5. Paste and execute the SQL

This will create:
- `profiles` table - for storing user profile information
- `notifications` table - for storing user notifications
- Row Level Security (RLS) policies to ensure users can only access their own data

### 2. Create Storage Bucket

1. Go to Storage in your Supabase dashboard
2. Click "New Bucket"
3. Name it: `documents`
4. Make it **Private** (not Public)
5. Click "Create bucket"

The storage policies are already configured in the migrations.sql file, but you may need to create them manually if they didn't apply automatically.

### 3. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 4. Configure Email Verification (Optional but Recommended)

1. In Supabase Dashboard, go to Authentication > Email Templates
2. Customize the confirmation email if desired
3. Enable "Confirm email" in Authentication > Providers > Email

### 5. Test the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to http://localhost:3000/signup
3. Create a new account with your email
4. Check your email for the verification link
5. Click the verification link
6. Navigate to http://localhost:3000/login and sign in with your credentials
7. You should now be able to access the profile page

## Features Implemented

### Authentication
- ✅ User signup with email verification
- ✅ User login
- ✅ Protected routes (redirect to login if not authenticated)
- ✅ Logout functionality

### Profile Management
- ✅ View and edit user information (name, phone, location)
- ✅ Upload passport/documents (optional)
- ✅ Display email verification status
- ✅ Password deletion functionality

### Notifications
- ✅ Display notifications from Supabase database
- ✅ Mark notifications as read
- ✅ Real-time notification loading

### Removed Features
- ✅ Hardcoded stats ("12 Flights Today", "2 Delayed", "5 Alerts")
- ✅ Map description text
- ✅ Settings panel with hardcoded preferences
- ✅ Change password popup (replaced with delete password button)

## Database Tables

### profiles
```
id (UUID) - User ID from auth.users
full_name (TEXT)
email (TEXT)
phone (TEXT)
location (TEXT)
passport_document (TEXT) - URL to uploaded document
other_documents (TEXT[]) - Array of document URLs
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### notifications
```
id (UUID) - Primary key
user_id (UUID) - Reference to auth.users
title (TEXT)
message (TEXT)
type (TEXT) - 'info', 'warning', 'error', 'success'
read (BOOLEAN)
created_at (TIMESTAMP)
```

## Adding Sample Notifications

To test the notifications feature, run this in the Supabase SQL Editor:

```sql
INSERT INTO notifications (user_id, title, message, type) 
VALUES (
  (SELECT id FROM auth.users LIMIT 1),  -- Replace with actual user ID
  'Welcome',
  'Welcome to your dashboard!',
  'success'
);
```

## Troubleshooting

### "403 Forbidden" on profile page
- Make sure your user is logged in
- Check that the RLS policies are correctly configured
- Verify the user ID matches in the browser console

### Document upload not working
- Make sure the storage bucket "documents" exists and is private
- Check that storage policies are enabled
- Verify the SUPABASE_SERVICE_ROLE_KEY is correct in .env.local

### Email verification not received
- Check spam/junk folder
- Make sure email is enabled in Supabase Authentication > Email
- Test with Supabase-provided test email

## Next Steps

1. Customize email templates in Supabase Dashboard
2. Set up email templates for password reset
3. Add more notification types and triggers
4. Implement real-time notifications using Supabase subscriptions
5. Add more profile fields as needed
