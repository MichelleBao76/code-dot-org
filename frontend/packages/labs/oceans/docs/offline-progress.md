# Local progress and connection interruptions

## Scope

The React OceansLab entrypoint saves training on this browser and device by default.
The saved checkpoint contains the classifier examples, answer counts, selected word,
training question, dismissed guide IDs, and the stage the student was on. Reloading
returns to that stage with a new object queue: the word picker, training, or testing.
A student who was viewing results resumes at testing; pressing Run rebuilds the
predictions from the restored model. Resuming at the word picker after New Word
restores only dismissed guides, so the erased word does not return. Saves made
before stages were recorded resume at training. Prediction animation position,
results layout, course completion, and teacher records are not saved.

Saves are about 4,100 characters per answer in the image modes (256 numbers per
example), so the 4,000,000-character limit allows roughly 970 answers.

KNN stores its feature tensors; SVM stores its labelled feature vectors. Neither
requires a network request to classify objects once the game resources are loaded.
Writes are delayed by 300 ms and combined across animation frames. Leaving or hiding
the page and network changes also flush the save. An abrupt browser or device crash
can lose the most recent unsaved answer. Corrupt or unavailable storage shows a notice
and leaves the in-memory activity usable. The previous save remains if a new write fails.

## Integration

`<OceansLab progressKey="student-and-activity-slot" />` selects a device-local slot.
The slot also includes app mode, guide sequence, and language. Supply a stable,
opaque student-specific key on shared devices. Do not use a name or email address.
The standalone default is `oceans-local`; pass an empty string to disable saving.
Imperative consumers must supply `progressKey` to `initAll` to enable saving.
The demonstration mode does not save or restore student training.

Erase clears training examples and counters and replaces the checkpoint. On shared
devices, erase before leaving. Saves are not encrypted and do not follow a student
between devices or browsers. Clearing site data removes them. There is no server
upload, automatic synchronization, or conflict resolution on reconnect.

The offline notice uses browser connectivity events as a hint, not a guarantee of
internet access. The current loaded activity can keep training and sorting. Opening
new pages, loading missing resources, and reloading fully offline require the resource
caching work assigned to Parts 1–2. This change does not install a service worker or
claim that course materials have been downloaded. Integrate and test those changes
before demonstrating complete offline access.

## Automated checks

`test/unit/oceans/progress.test.ts` covers both classifier restores, predictions after
restoration, debounced writes, Erase, save-slot isolation, invalid data, and storage
failure. `e2e/offline-progress.spec.ts` disconnects the browser after loading, answers
offline, reconnects, reloads, checks counts, and runs the restored model for pixel and
word modes. Browser emulation is not a substitute for testing Android hardware.

Run from `frontend/`:

```sh
yarn workspace @code-dot-org/oceans-lab run test
yarn workspace @code-dot-org/oceans-lab run test:ui e2e/offline-progress.spec.ts
yarn release:dryrun --filter=@code-dot-org/oceans-lab
yarn workspace @code-dot-org/oceans-lab run typecheck
```

## Final integration and demonstration checklist

Record device model, OS/browser version, activity mode, result, and any failure.

- Load Fish vs Trash, Creatures vs Trash, Short, and Long online. Answer at least
  ten objects and wait for the save notice. Record counts and word.
- Disable Wi-Fi and mobile data completely. Answer ten more objects and run sorting.
  Check the offline notice, answer counts, and predictions. Listen to the notice
  with TalkBack or VoiceOver; it must not move keyboard focus.
- Reconnect. Check that counts do not reset or double and that the reconnect notice
  does not claim an upload. Reload and verify the model, counts, word, and guides.
- Erase, reload, and verify zero examples. Switch activity modes and verify isolation.
- Repeat with browser storage blocked or full; verify the warning and usable controls.
- After merging Parts 1–2 caching: download course/game resources online, close the
  browser, disconnect all networks, reopen the course, and complete all activities.
  Include unavailable-resource and interrupted-download cases.
- Repeat on a physical Android phone and tablet, including a lower-memory device.
  Record time to save, reload, and run the restored model. Check touch targets and
  whether the notice obscures instructions at the smallest supported size.
- Open a PR against the team's integration branch. Include automated results,
  physical-device results, known limits, and the dependency on Parts 1–2.

Physical Android, fully offline reopening, course pages, and the combined team
build remain manual integration checks until those results are recorded.

## Results recorded November 18, 2026

- Passed: 87 Oceans unit tests; scoped release checks (18 tasks including build,
  lint, formatting, and type checks).
- Passed: six browser scenarios covering Fish vs Trash and Long mode at desktop,
  phone, and tablet dimensions. Each scenario trained after a simulated network
  disconnect, reconnected, reloaded saved training, and reached sorting results
  during a second disconnect. These runs used installed Chrome for all viewport
  profiles; they do not establish Android, Safari, or iPadOS compatibility.
- Checked visually: the phone notice is readable below the game without covering
  answer or navigation buttons.
- Pending: physical Android tests (no Android device available), screen reader
  announcement testing, and offline course/reopening checks with Parts 1–2 caching.
