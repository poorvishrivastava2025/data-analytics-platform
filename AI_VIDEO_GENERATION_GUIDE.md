# AI Teacher Video Generation & Virtual Studio Guide

This guide documents the architecture, provider configuration, avatar personas, bilingual capabilities, and production workflows for the **AI Teacher Video** system in AnalystPath AI.

---

## 1. Architectural Overview & Design Philosophy

Every lesson across all 18 curriculum courses (22 total lessons, beginner to advanced) includes full **AI Teacher Video** capabilities. The system operates on a dual-engine architecture:

1. **Interactive AI Teacher Studio Preview (Always Online & Free)**:
   - When external video generation credentials are not configured, the platform activates the **Interactive AI Teacher Virtual Stage**.
   - Displays a visible AI mentor avatar (**"Ananya"**), animated speaking aura, live Web Speech API text-to-speech synthesis in both **English** and **Hindi**, synchronized on-screen visual stages (code editors, query output tables, architectural workflow cards, and common pitfall matrices), and floating closed captions `[CC]`.
   - **Honest Status Display**: Displays `🟡 Video Rendering Pending — Video generation credentials not configured.` Never pretends a pre-rendered MP4 video exists when it does not.

2. **Production Pre-Rendered Avatar Video Pipeline (Enterprise Rendering)**:
   - Integrates server-side with leading AI avatar video providers: **HeyGen**, **D-ID**, and **Synthesia**.
   - When configured with API keys in `.env`, administrators can dispatch automated rendering jobs directly from the **Admin AI Video Studio** dashboard or lesson player.
   - When rendering completes, the external video URL (MP4 / HLS) is ingested and served seamlessly while keeping the interactive timestamped transcripts and note-taking panels fully synchronized.

---

## 2. AI Teacher Persona: "Ananya"

- **Name**: Ananya
- **Role**: Lead Data Analyst Mentor
- **Specialization**: SQL, Python, Business Analytics, Dimensional Modeling, Statistical Intuition, and Technical Interview Preparation.
- **Visual Presentation**: Professional studio setting with split-screen demonstration board.
- **Narration Tone**: Encouraging, precise, industry-focused, and step-by-step.

---

## 3. Bilingual Language Support (English & Hindi/Hinglish)

Learners can switch between **English** and **Hindi / Hinglish** directly on the lesson video player header:

- **Bilingual Scripts & Transcripts**:
  - Every lesson has structured 5-part scripts in both languages:
    1. *Introduction & Target Learning Goals*
    2. *Step-by-Step Foundational Mechanics*
    3. *Live Hands-On Code, Query & Formula Walkthrough*
    4. *Common Industry Mistakes & Production Fixes*
    5. *Recap & End-of-Lesson Test Challenge*
- **Speech Synthesis (TTS)**:
  - English: Uses natural regional English voice (`en-US`, `en-IN`, or `en-GB`).
  - Hindi: Uses natural Hindi speech engine (`hi-IN`).
- **Closed Captions `[CC]`**:
  - Displays real-time subtitle cues at the bottom of the virtual stage in the selected language.
  - Can be toggled on/off at any time.
- **State Persistence**:
  - Switching languages preserves the current playback timestamp (`curSec`), active test responses, and learner notes.
  - The preferred language and last watched position are automatically saved to `lesson_progress` via `POST /api/lessons/:id/playback-position`.

---

## 4. Supported Video Providers & Configuration

### A. HeyGen
HeyGen generates photo-realistic digital avatars with studio lighting.

1. Obtain an API key from [HeyGen Developer Portal](https://www.heygen.com/).
2. Add to `.env`:
   ```env
   HEYGEN_API_KEY=your_heygen_api_key_here
   ```
3. Default Avatar ID: `avatar_ananya_analyst`
4. Default Voice ID:
   - English: `en_female_data_mentor`
   - Hindi: `hi_female_data_mentor`

### B. D-ID
D-ID provides real-time digital human animation from still portraits and audio.

1. Obtain an API key from [D-ID Studio](https://www.d-id.com/).
2. Add to `.env`:
   ```env
   DID_API_KEY=your_did_api_key_here
   ```

### C. Synthesia
Enterprise avatar generation for structured training modules.

1. Add to `.env`:
   ```env
   SYNTHESIA_API_KEY=your_synthesia_api_key_here
   ```

### D. ElevenLabs (Voice Cloning)
Used for high-fidelity voice cloning when synthesizing audio for video avatars.

1. Add to `.env`:
   ```env
   ELEVENLABS_API_KEY=your_elevenlabs_key_here
   ```

---

## 5. Webhook Integration for Async Generation

External rendering jobs take 1–5 minutes. Once rendered, the provider notifies the platform via the secure webhook callback:

- **Endpoint**: `POST /api/videos/webhook`
- **Payload Schema**:
  ```json
  {
    "job_id": "vjob_9a8b7c6d5e4f",
    "external_job_id": "heygen_task_12345",
    "status": "ready",
    "language": "en",
    "video_url": "https://cdn.example.com/videos/setup-101-en.mp4",
    "error": null
  }
  ```
- The backend automatically updates `video_generation_jobs` and populates `video_url` or `video_url_hi` in the `lessons` table.

---

## 6. Admin Video Studio & Asset Updates (Zero Data Loss)

Platform owners and administrators have full control over video assets:

1. **In-Lesson Video Asset Editor**:
   - Logged-in admins will see an `⚙️ Admin: Edit Video Asset` button above the video stage.
   - Allows updating:
     - English Video URL (`video_url`)
     - Hindi Video URL (`video_url_hi`)
     - English Duration (`video_duration`)
     - Hindi Duration (`video_duration_hi`)
     - Video Provider (`heygen`, `did`, `synthesia`)
     - Video Status (`pending`, `generating`, `ready`)
   - **Guaranteed Zero Data Loss**: Updates solely touch the `lessons` table. Learner notes (`user_notes`), test scores, XP, and lesson completion status (`lesson_progress`) are 100% preserved.

2. **Admin Console "AI Video Studio" Tab**:
   - Accessible at `#admin` for users with the `admin` role.
   - Shows the live generation job queue, status breakdowns, and a curriculum matrix of all 22 lessons with direct editing modals.

---

## 7. Honest Status Compliance Checklist

- [x] **No Fake Video Files**: When MP4 URLs are not present, lessons are clearly labeled `🟡 Video Rendering Pending — Video generation credentials not configured`.
- [x] **Interactive Studio Active**: Browser Web Speech synthesis and split-screen stage provide a genuine, valuable learning experience even without external API keys.
- [x] **Secure Secrets**: Provider API keys (`HEYGEN_API_KEY`, `DID_API_KEY`, etc.) are read strictly by Node.js on the server and are never exposed in client JavaScript or network payloads.
- [x] **Bilingual Parity**: Every lesson provides equivalent scripts, transcripts, and learning objectives in both English and Hindi.
