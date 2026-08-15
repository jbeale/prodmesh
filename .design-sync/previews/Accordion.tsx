import { Accordion } from 'church-production-dashboard';

// The text-heavy solo of the calibration set: if the bundled IBM Plex families
// were not shipping, this is the story where it would show. Prose, a collapsed
// state carrying a summary, and a nested pair — the three ways Admin uses it.

export const Default = () => (
  <Accordion title="ProPresenter" defaultOpen>
    <p>
      The API port is picked per machine and can change when ProPresenter
      restarts unless it is pinned in Network preferences. Enter the host and
      port exactly as the Network panel reports them.
    </p>
  </Accordion>
);

// Collapsed is the state most of these are in most of the time, and the
// summary is what makes a closed row worth reading.
export const Collapsed = () => (
  <Accordion title="Smaart" summary="Not configured">
    <p>Point this at the analyzer machine to log SPL for the room.</p>
  </Accordion>
);

export const WithSummary = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <Accordion title="ProPresenter" summary="192.0.2.14:1025" defaultOpen>
      <p>
        Slide position streams over a chunked connection, with a five second
        watchdog behind it. ProPresenter coalesces rapid advances, so a slide
        passed through quickly is never announced.
      </p>
    </Accordion>
    <Accordion title="Companion" summary="192.0.2.31">
      <p>Room mode is written to a Companion variable the wall panel reads.</p>
    </Accordion>
    <Accordion title="Captions" summary="Off">
      <p>
        A caption app transcribes the production comms channels so the band can
        read what the music director is saying.
      </p>
    </Accordion>
  </div>
);
