import { type CSSProperties, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import platesQuestLogoUrl from "../platesquest.svg";
import { PLATES_BY_REGION, REGION_DETAILS, platesForRegions } from "../shared/catalog";
import { REGION_IDS, type RegionId, type TripSnapshot } from "../shared/types";
import { navigate, useLocalState, usePathname, useSyncState } from "./hooks";
import {
  createLocalTrip,
  joinLocalTrip,
  renameLocalTrip,
  setLocalRegions,
  setLocalPlate,
  type LocalTrip,
} from "./lib/store";
import { fetchRemoteTrip, startBackgroundSync, syncTrips } from "./lib/sync";
import { plateTheme } from "./lib/plateTheme";

const ARCHIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

function ArrowLeftIcon() {
  return <i className="bi bi-arrow-left" aria-hidden="true" />;
}

function ArrowRightIcon() {
  return <i className="bi bi-chevron-right" aria-hidden="true" />;
}

function TripArrowIcon() {
  return <img className="trip-card__arrow" src="/shsm-standard-arrow.svg" alt="" aria-hidden="true" />;
}

function BackArrowIcon() {
  return <img className="back-button__arrow" src="/shsm-standard-arrow.svg" alt="" aria-hidden="true" />;
}

function ButtonSignArrowIcon() {
  return <img className="button__sign-arrow" src="/shsm-standard-arrow.svg" alt="" aria-hidden="true" />;
}

function EditRegionsArrowIcon() {
  return <img className="edit-regions-card__arrow" src="/shsm-standard-arrow.svg" alt="" aria-hidden="true" />;
}

function CheckIcon() {
  return <i className="bi bi-check-lg" aria-hidden="true" />;
}

function PlusIcon() {
  return <i className="bi bi-plus-lg" aria-hidden="true" />;
}

function ShareIcon() {
  // Exact arrow silhouette from the public-domain MUTCD W3-1 reference supplied by the user.
  const arrowPath = "m 221.61784,189.3359 c -1.58265,0.0165 -3.07214,0.12087 -4.53266,0.50363 -4.86002,1.27928 -8.13864,6.81912 -4.78447,11.33164 1.55621,2.09002 3.65131,3.97367 5.41401,5.91764 4.00385,4.42687 8.08324,8.92428 12.08708,13.34616 -18.45295,8.38035 -36.3922,21.17758 -47.34109,38.52759 -10.88853,17.2795 -12.63096,36.02461 -12.59071,55.90278 0.0161,12.55244 -0.19017,36.71519 0,42.55662 l 38.7794,0 c 0.001,-5.37133 0,-10.744 0,-16.11611 0.012,-12.06686 -0.004,-24.06334 0.12571,-36.13536 0.0955,-9.52374 2.12531,-18.49311 7.30261,-26.56641 8.03287,-12.54028 22.6633,-20.79482 35.37991,-27.44776 l 0,0.1257 c 1.72242,5.71115 3.44483,11.41739 5.1622,17.12338 0.67487,2.24119 1.07776,4.75421 2.26632,6.79898 2.57859,4.43701 8.87395,5.13203 12.46482,1.38498 1.98429,-2.06986 3.04192,-5.02629 4.28084,-7.55443 2.54836,-5.16723 5.137,-10.31934 7.68033,-15.48658 10.53089,-21.35888 20.95096,-42.72787 31.47679,-64.08675 -23.8317,0 -47.67851,0.0141 -71.51526,0 l -16.99747,0 c -1.49578,0 -3.07592,-0.14225 -4.65856,-0.12591 z";

  return (
    <svg className="share-button__arrow" viewBox="55 184 269 179" aria-hidden="true" focusable="false">
      <path d={arrowPath} />
      <path d={arrowPath} transform="translate(378.5194 0) scale(-1 1)" />
    </svg>
  );
}

function HeaderTruss() {
  const rails = "M0 12H1000 M0 104H1000 M0 104L100 12L200 104L300 12L400 104L500 12L600 104L700 12L800 104L900 12L1000 104";

  return (
    <svg
      className="header-truss"
      viewBox="0 0 1000 116"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="header-truss__outline" d={rails} />
      <path className="header-truss__frame" d={rails} />
    </svg>
  );
}

function ArchivedArrowIcon() {
  return (
    <svg
      className="archived-list__arrow"
      viewBox="0 0 812.80001 558.78761"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="translate(-5.8632079 110.99789)" fill="currentColor">
        <path
          d="m118.16016 156.43359a96 96 0 0 0-96.000004 96 96 96 0 0 0 31.408203 70.97852l-.01563.0273L1558.1602 1692.4336 3062.7676 323.43945l-.016-.0273a96 96 0 0 0 31.4082-70.97852 96 96 0 0 0-96-96 96 96 0 0 0-23.9649 3.10352l-.031-.0566-1103.9883 285H1246.1756l-1104.01955-285-.002.004a96 96 0 0 0-23.99414-3.05079z"
          transform="scale(.26458333)"
        />
        <path d="M329.71323-110.99789h165.10001v228.60001H329.71323z" />
      </g>
    </svg>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <button
      className={`brand ${compact ? "brand--compact" : ""}`}
      type="button"
      aria-label="Go to trips"
      onClick={() => navigate("/")}
    >
      <img className="brand__logo" src={platesQuestLogoUrl} alt="" aria-hidden="true" />
    </button>
  );
}

function formatRelative(timestamp: number): string {
  const elapsedDays = Math.floor((Date.now() - timestamp) / (24 * 60 * 60 * 1000));
  if (elapsedDays <= 0) return "today";
  if (elapsedDays === 1) return "yesterday";
  if (elapsedDays < 30) return `${elapsedDays} days ago`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(timestamp);
}

function tripProgress(trip: TripSnapshot) {
  const plates = platesForRegions(trip.regions);
  const found = plates.filter((plate) => trip.plates[plate.id]?.checked).length;
  return { found, total: plates.length, percent: plates.length ? (found / plates.length) * 100 : 0 };
}

function TripCard({ trip }: { trip: LocalTrip }) {
  const progress = tripProgress(trip);
  return (
    <button className="trip-card" onClick={() => navigate(`/${trip.id}`)}>
      <div className="trip-card__top">
        <div>
          <h3>{trip.name}</h3>
        </div>
        <div className="trip-card__end">
          <span className="trip-card__seen"><strong>{progress.found}</strong><span>SEEN</span></span>
          <TripArrowIcon />
        </div>
      </div>
    </button>
  );
}

function EmptyTrips({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="empty-state">
      <div className="empty-state__road" aria-hidden="true"><i /><i /><i /></div>
      <span className="eyebrow">No trips yet</span>
      <h2>The road is calling.</h2>
      <p>Start a trip, pick your regions, and see how many plates you can spot along the way.</p>
      <button className="button button--primary" onClick={onCreate}><PlusIcon /> Start a trip</button>
    </section>
  );
}

function RegionPicker({ regions, onToggle }: { regions: RegionId[]; onToggle: (region: RegionId) => void }) {
  return (
    <div className="region-options">
      {REGION_IDS.map((region) => {
        const selected = regions.includes(region);
        const count = PLATES_BY_REGION[region].length;
        return (
          <label className={`region-option ${selected ? "is-selected" : ""}`} key={region}>
            <input type="checkbox" checked={selected} onChange={() => onToggle(region)} />
            <span className="region-option__check">{selected && <CheckIcon />}</span>
            <span><strong>{REGION_DETAILS[region].name}</strong><small>{count} plates</small></span>
          </label>
        );
      })}
    </div>
  );
}

function NewTripDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [regions, setRegions] = useState<RegionId[]>(["us", "canada", "mexico"]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  function toggleRegion(region: RegionId) {
    setRegions((current) => current.includes(region)
      ? current.filter((item) => item !== region)
      : [...current, region]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || regions.length === 0) return;
    const trip = createLocalTrip(cleanName, regions);
    void syncTrips(trip.id);
    navigate(`/${trip.id}`);
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="dialog dialog--sign" role="dialog" aria-modal="true" aria-labelledby="new-trip-title">
        <div className="dialog__handle" />
        <h2 id="new-trip-title">New trip</h2>
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="trip-name">Trip name</label>
          <input
            ref={inputRef}
            id="trip-name"
            className="text-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            placeholder="Summer coast drive"
            required
          />
          <fieldset>
            <legend className="field-label">Plate regions</legend>
            <RegionPicker regions={regions} onToggle={toggleRegion} />
          </fieldset>
          <div className="dialog__actions">
            <button className="button button--quiet" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary button--create-trip" type="submit" disabled={!name.trim() || regions.length === 0}>
              Create trip <ButtonSignArrowIcon />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EditRegionsDialog({ trip, onClose }: { trip: LocalTrip; onClose: () => void }) {
  const [regions, setRegions] = useState<RegionId[]>(trip.regions);
  const unchanged = regions.length === trip.regions.length
    && regions.every((region) => trip.regions.includes(region));

  function toggleRegion(region: RegionId) {
    setRegions((current) => current.includes(region)
      ? current.filter((item) => item !== region)
      : [...current, region]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (regions.length === 0) return;
    if (!unchanged) {
      setLocalRegions(trip.id, regions);
      void syncTrips(trip.id);
    }
    onClose();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="dialog dialog--sign" role="dialog" aria-modal="true" aria-labelledby="edit-regions-title">
        <div className="dialog__handle" />
        <h2 id="edit-regions-title">Trip settings</h2>
        <form onSubmit={submit}>
          <fieldset>
            <legend className="field-label">Plate regions</legend>
            <RegionPicker regions={regions} onToggle={toggleRegion} />
          </fieldset>
          <div className="dialog__actions">
            <button className="button button--quiet" type="button" onClick={onClose}>Cancel</button>
            <button className="button button--primary" type="submit" disabled={regions.length === 0}>
              Save regions <ButtonSignArrowIcon />
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TripsPage() {
  const state = useLocalState();
  const [creating, setCreating] = useState(false);
  const trips = Object.values(state.trips).sort((a, b) => b.updatedAt - a.updatedAt);
  const cutoff = Date.now() - ARCHIVE_AFTER_MS;
  const active = trips.filter((trip) => trip.updatedAt >= cutoff);
  const archived = trips.filter((trip) => trip.updatedAt < cutoff);

  return (
    <div className="page-shell">
      <header className="home-header"><HeaderTruss /><Brand /></header>
      <main className="trips-page">
        <div className="page-title-row">
          <div><h1>Trips</h1></div>
          {trips.length > 0 && (
            <button className="button button--primary button--small" onClick={() => setCreating(true)}>
              <PlusIcon /> NEW TRIP
            </button>
          )}
        </div>

        {trips.length === 0 ? <EmptyTrips onCreate={() => setCreating(true)} /> : (
          <>
            <section className="trip-list" aria-labelledby="active-trips-title">
              {active.length > 0
                ? active.map((trip) => <TripCard trip={trip} key={trip.id} />)
                : <p className="subtle-copy">No active trips. Your older trips are tucked away below.</p>}
            </section>

            {archived.length > 0 && (
              <details className="archived-list">
                <summary><span>Archived trips</span><ArchivedArrowIcon /></summary>
                <div className="trip-list">{archived.map((trip) => <TripCard trip={trip} key={trip.id} />)}</div>
              </details>
            )}
          </>
        )}
      </main>
      {creating && <NewTripDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function SyncBadge({ tripId, updatedAt }: { tripId: string; updatedAt: number }) {
  const sync = useSyncState();
  const state = useLocalState();
  const pending = state.pending.filter((operation) => operation.tripId === tripId).length;
  const updated = `Updated ${formatRelative(updatedAt)}`;
  const isOffline = sync.phase === "offline" || sync.phase === "error";
  const text = isOffline
    ? `${updated} offline`
    : sync.phase === "syncing"
      ? "Syncing…"
      : pending > 0
        ? "Saving…"
        : updated;
  return <span className="sync-badge">{text}</span>;
}

function EditableTitle({ trip }: { trip: LocalTrip }) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    const title = titleRef.current;
    if (title && document.activeElement !== title && title.textContent !== trip.name) {
      title.textContent = trip.name;
    }
  }, [trip.name]);

  function commit() {
    const title = titleRef.current;
    if (!title) return;

    if (cancelledRef.current) {
      cancelledRef.current = false;
      title.textContent = trip.name;
      return;
    }

    const name = (title.textContent ?? "").trim();
    if (name && name !== trip.name) {
      title.textContent = name;
      renameLocalTrip(trip.id, name);
      void syncTrips(trip.id);
    } else {
      title.textContent = trip.name;
    }
  }

  function selectTitle() {
    const title = titleRef.current;
    const selection = window.getSelection();
    if (!title || !selection) return;

    const range = document.createRange();
    range.selectNodeContents(title);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  return (
    <div className="editable-title">
      <h1>
        <span
          ref={titleRef}
          contentEditable="plaintext-only"
          suppressContentEditableWarning
          role="textbox"
          aria-label="Trip name"
          aria-multiline="false"
          spellCheck={false}
          title="Click to edit"
          onBlur={commit}
          onFocus={() => {
            cancelledRef.current = false;
            selectTitle();
          }}
          onInput={(event) => {
            const title = event.currentTarget;
            const text = title.textContent ?? "";
            if (text.length <= 80) return;

            title.textContent = text.slice(0, 80);
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(title);
            range.collapse(false);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              cancelledRef.current = true;
              event.currentTarget.textContent = trip.name;
              event.currentTarget.blur();
            }
          }}
        >
          {trip.name}
        </span>
      </h1>
    </div>
  );
}

function PlateSection({ trip, region }: { trip: LocalTrip; region: RegionId }) {
  const plates = PLATES_BY_REGION[region];
  const found = plates.filter((plate) => trip.plates[plate.id]?.checked).length;
  return (
    <section className="plate-section" aria-labelledby={`region-${region}`}>
      <div className="plate-section__heading">
        <div><h2 id={`region-${region}`}>{REGION_DETAILS[region].name}</h2></div>
        <strong>{found}<i> / {plates.length}</i></strong>
      </div>
      <div className="plate-grid">
        {plates.map((plate) => {
          const checked = trip.plates[plate.id]?.checked ?? false;
          const theme = plateTheme(plate);
          const style = {
            "--plate-foreground": theme.foreground,
            "--plate-background": theme.background,
          } as CSSProperties;
          return (
            <label className={`plate-item ${checked ? "is-checked" : ""}`} key={plate.id} style={style}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  setLocalPlate(trip.id, plate.id, event.target.checked);
                  void syncTrips(trip.id);
                }}
              />
              <span className="plate-item__code">{plate.code}</span>
              <span className="plate-item__name">{plate.name}</span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function JoinTrip({ trip, onJoin }: { trip: TripSnapshot; onJoin: () => void }) {
  const progress = tripProgress(trip);
  return (
    <main className="join-page">
      <div className="join-card">
        <div className="join-card__plate">SHARED TRIP</div>
        <h1>{trip.name}</h1>
        <p><strong>{progress.found}</strong> plate{progress.found === 1 ? "" : "s"} seen</p>
        <button className="button button--primary button--wide" onClick={onJoin}>Join trip <ArrowRightIcon /></button>
        <small>Joining saves this trip to this device. Anyone with the link can edit.</small>
      </div>
    </main>
  );
}

function MissingTrip({ message }: { message: string }) {
  return (
    <main className="join-page">
      <div className="join-card">
        <span className="eyebrow">Dead end</span>
        <h1>Trip not found</h1>
        <p>{message}</p>
        <button className="button button--primary" onClick={() => navigate("/")}><ArrowLeftIcon /> Trips</button>
      </div>
    </main>
  );
}

function TripPage({ tripId }: { tripId: string }) {
  const state = useLocalState();
  const trip = state.trips[tripId];
  const [candidate, setCandidate] = useState<TripSnapshot | null>(null);
  const [loading, setLoading] = useState(!trip);
  const [loadError, setLoadError] = useState("");
  const [shareLabel, setShareLabel] = useState("Share");
  const [editingRegions, setEditingRegions] = useState(false);

  useEffect(() => {
    if (trip) {
      void syncTrips(tripId);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchRemoteTrip(tripId)
      .then((remote) => { if (!cancelled) setCandidate(remote); })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(
          navigator.onLine
            ? (error instanceof Error ? error.message : "This link may be invalid.")
            : "Connect to the internet once to join this trip.",
        );
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tripId, Boolean(trip)]);

  async function share() {
    const data = { title: trip?.name ?? "Plates Quest", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(data.url);
        setShareLabel("Copied!");
        window.setTimeout(() => setShareLabel("Share"), 1600);
      }
    } catch {
      // Dismissing the native share sheet needs no error state.
    }
  }

  if (!trip) {
    if (loading) return <main className="join-page"><div className="loader"><i /><span>Finding your trip…</span></div></main>;
    if (candidate) return <JoinTrip trip={candidate} onJoin={() => joinLocalTrip(candidate)} />;
    return <MissingTrip message={loadError || "Check the link and try again."} />;
  }

  const progress = tripProgress(trip);
  return (
    <div className="page-shell trip-background">
      <header className="trip-header">
        <HeaderTruss />
        <button className="back-button" aria-label="Back to trips" onClick={() => navigate("/")}><BackArrowIcon /><span>Trips</span></button>
        <Brand compact />
        <button className="share-button" aria-label={shareLabel} onClick={() => void share()}><ShareIcon /><span>{shareLabel}</span></button>
      </header>
      <main className="trip-page">
        <div className="trip-hero">
          <EditableTitle trip={trip} />
          <div className="overall-progress">
            <div className="overall-progress__numbers"><SyncBadge tripId={trip.id} updatedAt={trip.updatedAt} /><strong>{progress.found}</strong><span> plate{progress.found === 1 ? "" : "s"} seen</span></div>
          </div>
        </div>
        <div className="plate-sections">
          {REGION_IDS
            .filter((region) => trip.regions.includes(region))
            .map((region) => <PlateSection key={region} trip={trip} region={region} />)}
          <button className="edit-regions-card" type="button" onClick={() => setEditingRegions(true)}>
            <span>EDIT TRIP REGIONS</span><EditRegionsArrowIcon />
          </button>
        </div>
      </main>
      {editingRegions && <EditRegionsDialog trip={trip} onClose={() => setEditingRegions(false)} />}
    </div>
  );
}

export default function App() {
  const pathname = usePathname();
  useEffect(startBackgroundSync, []);
  const tripId = useMemo(() => pathname.split("/").filter(Boolean)[0], [pathname]);
  return tripId ? <TripPage tripId={tripId} /> : <TripsPage />;
}
