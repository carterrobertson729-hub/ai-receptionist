# Adding the call recordings to the home page

The home page has a "Listen to real test calls" section with four players. Each player stays hidden ("Recording coming soon") until its file exists in the website's `audio` folder.

## The four files (exact names)
| File | What to record |
|---|---|
| `audio/barbershop-booking.mp3` | A call to the demo line booking a haircut (pick a time, give a name and number) |
| `audio/barbershop-cancel.mp3` | A call cancelling that booking |
| `audio/plumbing-urgent.mp3` | The plumbing demo agent: a leak, the safety question, the details (needs the plumbing demo agent; use a Retell web call until it has a number) |
| `audio/spanish-booking.mp3` | A booking call in Spanish (best with a native speaker) |

## How to make each one
1. Make a real test call (phone to (219) 587-7319, or Retell's web call). Use a fake name and a number that isn't a real customer's. Never use a real customer's call without their written permission.
2. In Retell: Call history, open the call, download the recording.
3. Trim dead air at the start and end with a free tool (Audacity, or an online audio cutter). Aim for under 2 minutes.
4. Export as MP3, mono, about 64 kbps (a 2-minute call is then about 1 MB).
5. Name the file exactly as above and put it in a folder called `audio` inside the website folder, next to `index.html`.
6. Upload the website folder to Netlify as usual.

You can add them one at a time. Players without a file just say "Recording coming soon".

Check the first words of each recording: callers should hear the receptionist say it is an automated assistant if asked, and nothing in the call should reveal a private number or address.
