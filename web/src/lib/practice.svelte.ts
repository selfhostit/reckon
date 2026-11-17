import { pb } from './pb';
import {
  newProgress,
  toDate,
  type Answer,
  type LessonFamily,
  type Mode,
  type Progress,
  type Result,
  type SessionSummary,
} from './practice';
import { session } from './session.svelte';

const SUMMARY_FIELDS = 'id,kind,family,mode,level,level_after,started,ended,result';

interface ProgressRecord extends Progress {
  id: string;
  user: string;
}

export interface NewSession {
  kind: 'practice' | 'test';
  family?: LessonFamily;
  mode?: Mode;
  level?: number;
  level_after?: number;
  started: number;
  ended: number;
  items: Answer[];
  result: Result;
}

// The signed-in person's levels, XP and streak, and the summaries of their
// sessions. The answers of a session are only fetched when it is reviewed.
class PracticeStore {
  progress = $state<Progress>(newProgress());
  sessions = $state<SessionSummary[]>([]);
  loaded = $state(false);
  error = $state('');
  private id = '';
  private user = session.user?.id;
  private loading: Promise<void> | null = null;
  private saving: Promise<unknown> = Promise.resolve();

  constructor() {
    // someone else signing in on this device starts from their own progress
    pb.authStore.onChange(() => {
      const user = pb.authStore.record?.id;
      if (user === this.user) return;
      this.user = user;
      this.progress = newProgress();
      this.sessions = [];
      this.id = '';
      this.loaded = false;
    });
  }

  /** Loads everything once; calls while it is loading share the requests. */
  load() {
    this.loading ??= this.fetch().finally(() => (this.loading = null));
    return this.loading;
  }

  private async fetch() {
    this.error = '';
    try {
      const user = session.user!.id;
      const [progress, sessions] = await Promise.all([
        pb.collection('progress').getList<ProgressRecord>(1, 1, {
          filter: pb.filter('user = {:user}', { user }),
          requestKey: null,
        }),
        pb.collection('practice_sessions').getFullList<SessionSummary>({
          filter: pb.filter('user = {:user}', { user }),
          sort: 'started',
          fields: SUMMARY_FIELDS,
          requestKey: null,
        }),
      ]);
      const p = progress.items[0];
      if (p) {
        this.id = p.id;
        const fresh = newProgress();
        this.progress = {
          xp: p.xp,
          daily_goal: p.daily_goal || fresh.daily_goal,
          skills: { ...fresh.skills, ...(p.skills ?? {}) },
          days: p.days ?? {},
          reminders: p.reminders,
        };
      }
      this.sessions = sessions;
      this.loaded = true;
    } catch {
      this.error = "Couldn't load your progress.";
    }
  }

  /** Saves new progress; saves run one after another so none is lost. */
  setProgress(p: Progress) {
    this.progress = p;
    const body = $state.snapshot(p);
    this.saving = this.saving
      .catch(() => {})
      .then(async () => {
        if (this.id) await pb.collection('progress').update(this.id, body);
        else
          this.id = (
            await pb.collection('progress').create({ ...body, user: session.user!.id })
          ).id;
      });
    return this.saving;
  }

  /** Records a finished lesson or test and returns its summary. */
  async addSession(s: NewSession): Promise<SessionSummary> {
    const record = await pb.collection('practice_sessions').create<SessionSummary>(
      {
        user: session.user!.id,
        kind: s.kind,
        family: s.family ?? '',
        mode: s.mode ?? '',
        level: s.level ?? 0,
        level_after: s.level_after ?? 0,
        started: toDate(s.started),
        ended: toDate(s.ended),
        items: s.items,
        result: s.result,
      },
      { fields: SUMMARY_FIELDS },
    );
    this.sessions = [...this.sessions, record];
    return record;
  }

  /** A session with every answer, for the review screen. */
  answers(id: string) {
    return pb
      .collection('practice_sessions')
      .getOne<SessionSummary & { items: Answer[] }>(id, { requestKey: null });
  }

  /** Everything this person has, as one file to keep. */
  async export() {
    const items = await pb.collection('practice_sessions').getFullList({
      filter: pb.filter('user = {:user}', { user: session.user!.id }),
      sort: 'started',
      fields: SUMMARY_FIELDS + ',items',
    });
    return {
      app: 'reckon',
      exported: new Date().toISOString(),
      progress: this.progress,
      sessions: items,
    };
  }

  /** Deletes every session and starts the levels, XP and streak again. */
  async reset() {
    for (const s of this.sessions) await pb.collection('practice_sessions').delete(s.id);
    this.sessions = [];
    const fresh = newProgress();
    await this.setProgress({
      ...fresh,
      daily_goal: this.progress.daily_goal,
      reminders: this.progress.reminders,
    });
  }
}

export const practice = new PracticeStore();
