# LearnIQ Track

LearnIQ Track is a web-based system that combines AI-powered learning tools and an immersion tracking system for students. It allows teachers to generate learning materials and enables students to manage both academic and immersion activities in one platform.

---

## Features

### LearnIQ (AI Learning System)
- Upload lesson files (PDF / PPT)
- AI-generated:
  - Reviewer (summary)
  - Quiz (multiple choice questions)
  - Activities (essay, short answer, identification)
- Student quiz answering and scoring
- Leaderboard (optional)

### Immersion Tracker
- Time In / Time Out system
- Daily journal submission
- Attendance tracking
- Total hours monitoring

### User Roles
- Student
  - View lessons
  - Answer quizzes
  - Track immersion
- Teacher
  - Upload lessons
  - Generate AI content
  - Publish lessons
- Admin / Principal
  - Approve student accounts
  - Monitor system usage

---

## AI Integration
The system uses AI to generate:
- Reviewers (lesson summaries)
- Quiz questions
- Learning activities

---

## System Modules

1. LearnIQ Module  
   Focused on learning and academic content  

2. Immersion Tracker Module  
   Focused on student immersion monitoring  

---

## Tech Stack

- Frontend: HTML, CSS, JavaScript  
- Backend: Python (FastAPI / Flask)  
- Database: Supabase  
- AI: Google Gemini API  

---

## Authentication

- Student and Teacher accounts are stored in the database  
- Admin accounts are pre-created  
- Includes login, signup, and approval system  
- Forgot password feature is planned  

---

## Installation

```bash
git clone https://github.com/your-username/learniq-track.git
cd learniq-track
