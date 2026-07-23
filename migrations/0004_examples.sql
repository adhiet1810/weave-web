-- Seed: the daily-life example library.
-- Three read-only template vaults, each teaching a different Weave move.
-- Convention: example vaults use the 'ex-' prefix so projects.js hides them
-- from the user's own project list and protects them from edit/delete.
-- Idempotent: each vault is cleared before it is re-seeded.

-- ============================================================
-- ex-bedtime — "Why does bedtime keep melting down?"
-- Teaches the falsification core: rival hypotheses, each with a gap
-- that can kill it; confidence earned only by surviving a test.
-- ============================================================
DELETE FROM nodes    WHERE vault_id='ex-bedtime';
DELETE FROM facets   WHERE vault_id='ex-bedtime';
DELETE FROM edges    WHERE vault_id='ex-bedtime';
DELETE FROM captures WHERE vault_id='ex-bedtime';

INSERT INTO nodes (vault_id,id,kind,state,region,lean,cluster,title,distillate_text,distillate_confidence,distillate_updated,body,created,updated) VALUES
('ex-bedtime','bt-problem','problem','distilled','solve','inherit','bedtime','Bedtime melts down most nights','The 7pm routine collapses into tears 4–5 nights a week. Three explanations compete — only one has survived a test.',0.7,'2026-07-20T20:00:00+07:00','Tears, refusals, a 45-minute battle. Instead of guessing, name the competing causes and see which one makes a prediction that holds.','2026-07-20','2026-07-20T20:00:00+07:00'),
('ex-bedtime','bt-overtired','hypothesis','distilled','solve','inherit','bedtime','He is overtired — we start too late','Plausible on its face, but the one night we moved bedtime earlier it got worse. On the ropes.',0.22,'2026-07-20T20:00:00+07:00','The obvious first guess. It predicts: earlier bedtime = calmer. That prediction was tested.','2026-07-20','2026-07-20T20:00:00+07:00'),
('ex-bedtime','bt-hungry','hypothesis','distilled','solve','inherit','bedtime','He is hungry before bed','A bedtime snack should fix it. It does not. Barely standing.',0.2,'2026-07-20T20:00:00+07:00','Predicts: full belly = calm. Easy to test, and it failed.','2026-07-20','2026-07-20T20:00:00+07:00'),
('ex-bedtime','bt-connection','hypothesis','distilled','solve','inherit','bedtime','It is a bid for connection, not tiredness','The only explanation that made a prediction and got it right: calm nights track with one-on-one time.',0.63,'2026-07-20T20:00:00+07:00','Reframes the meltdown as a need, not a malfunction. Predicts: connect first = calmer bedtime.','2026-07-20','2026-07-20T20:00:00+07:00'),
('ex-bedtime','bt-reason','hypothesis','distilled','solve','inherit','bedtime','Ten minutes one-on-one first makes bedtime calm','Tested four nights: four calm. Small sample, but it is real signal — the premise the whole thing rests on.',0.66,'2026-07-20T20:00:00+07:00','A premise under "connection": the checkable claim that carries the weight. This is a Reason, not a restatement.','2026-07-20','2026-07-20T20:00:00+07:00'),
('ex-bedtime','bt-earlier-worse','gap','distilled','solve','inherit','bedtime','Earlier bedtime made it worse, not better','The prediction of "overtired" failed — earlier meant more tears. That is disconfirming, not neutral.',0.55,'2026-07-20T20:00:00+07:00','A blocker aimed at "overtired". A failed prediction should pull confidence down, not be quietly ignored.','2026-07-20','2026-07-20T20:00:00+07:00'),
('ex-bedtime','bt-after-dinner','gap','distilled','solve','inherit','bedtime','Melts down right after a full dinner','Full belly, same meltdown. The hunger explanation does not survive this.',0.55,'2026-07-20T20:00:00+07:00','A blocker aimed at "hungry". One clean counter-example is enough to sink a simple claim.','2026-07-20','2026-07-20T20:00:00+07:00'),
('ex-bedtime','bt-ritual','solution','distilled','solve','inherit','bedtime','A 10-minute wind-down: one-on-one, then lights','Act on the surviving explanation. Connection first; earlier lights only as a secondary lever.',0.55,'2026-07-20T20:00:00+07:00','Built from the hypothesis that survived — not the one that sounded best.','2026-07-20','2026-07-20T20:00:00+07:00'),
('ex-bedtime','bt-grandma','gap','distilled','solve','inherit','bedtime','Falls apart at grandma''s even with the ritual','A new place breaks the ritual. Even the winning path has a live threat — keep it honest.',0.4,'2026-07-20T20:00:00+07:00','A blocker on the solution. Surviving so far is not the same as solved.','2026-07-20','2026-07-20T20:00:00+07:00');

INSERT INTO facets (vault_id,node_id,name,semantic,distillate,confidence) VALUES
('ex-bedtime','bt-problem','trigger','gating','Starts the moment screens go off — or is that a coincidence worth checking?',0.5),
('ex-bedtime','bt-problem','consistency','accumulative','Worse on days with no nap — the pattern to explain.',0.55),
('ex-bedtime','bt-reason','evidence','informational','Four of four calm nights when we did the one-on-one first.',0.6);

INSERT INTO edges (vault_id,src,from_facet,to_id,to_facet,rel,note) VALUES
('ex-bedtime','bt-problem',NULL,'bt-overtired',NULL,'decomposes',NULL),
('ex-bedtime','bt-problem',NULL,'bt-hungry',NULL,'decomposes',NULL),
('ex-bedtime','bt-problem',NULL,'bt-connection',NULL,'decomposes',NULL),
('ex-bedtime','bt-connection',NULL,'bt-reason',NULL,'decomposes',NULL),
('ex-bedtime','bt-connection',NULL,'bt-ritual',NULL,'answers',NULL),
('ex-bedtime','bt-earlier-worse',NULL,'bt-overtired',NULL,'blocks',NULL),
('ex-bedtime','bt-after-dinner',NULL,'bt-hungry',NULL,'blocks',NULL),
('ex-bedtime','bt-grandma',NULL,'bt-ritual',NULL,'blocks',NULL);

INSERT INTO captures (vault_id,id,text,created) VALUES
('ex-bedtime','bt-cap','he asks for "five more minutes" — of what, exactly?','2026-07-20');

-- ============================================================
-- ex-tired — "Why am I tired every afternoon?"
-- Teaches decompose: one vague complaint split into checkable
-- hypotheses you test one at a time; one open question left unset.
-- ============================================================
DELETE FROM nodes    WHERE vault_id='ex-tired';
DELETE FROM facets   WHERE vault_id='ex-tired';
DELETE FROM edges    WHERE vault_id='ex-tired';
DELETE FROM captures WHERE vault_id='ex-tired';

INSERT INTO nodes (vault_id,id,kind,state,region,lean,cluster,title,distillate_text,distillate_confidence,distillate_updated,body,created,updated) VALUES
('ex-tired','tr-problem','problem','distilled','solve','inherit','energy','Wiped out every afternoon by 2pm','A daily 2–4pm crash. "Tired" is too vague to fix — break it into suspects and test them one at a time.',0.7,'2026-07-20T14:00:00+07:00','The move is not to solve "tiredness" — it is to turn one fuzzy feeling into a few claims that each make a testable prediction.','2026-07-20','2026-07-20T14:00:00+07:00'),
('ex-tired','tr-sleepdebt','hypothesis','distilled','solve','inherit','energy','Sleep debt — under 6.5h on weeknights','The weekday-only pattern fits this best. Leading suspect, but still unconfirmed — a week of tracking would settle it.',0.55,'2026-07-20T14:00:00+07:00','Fits the biggest clue (weekends are fine). Leading does not mean proven.','2026-07-20','2026-07-20T14:00:00+07:00'),
('ex-tired','tr-caffeine','hypothesis','distilled','solve','inherit','energy','Afternoon coffee wrecks the next day','Cut it for three days — no change. This one is out.',0.2,'2026-07-20T14:00:00+07:00','Predicts: no afternoon coffee = better mornings. Tested and disconfirmed.','2026-07-20','2026-07-20T14:00:00+07:00'),
('ex-tired','tr-lunch','hypothesis','distilled','solve','inherit','energy','Big carby lunches cause the crash','Untested. A light-lunch week would isolate it — the next experiment to run.',0.45,'2026-07-20T14:00:00+07:00','Plausible and checkable. Confidence stays middling until the experiment runs.','2026-07-20','2026-07-20T14:00:00+07:00'),
('ex-tired','tr-screens','hypothesis','distilled','solve','inherit','energy','Late screens push my sleep onset later','Overlaps with sleep debt, so hard to isolate alone. Untested as a standalone cause.',0.4,'2026-07-20T14:00:00+07:00','Note the entanglement: if this is true it may just be feeding sleep debt, not a separate cause.','2026-07-20','2026-07-20T14:00:00+07:00'),
('ex-tired','tr-iron','hypothesis','freeform','solve','inherit','energy','Could it be low iron?',NULL,NULL,NULL,'No position yet — an unknown to investigate, not a claim to defend. A blood test resolves it. Left open on purpose: its confidence is unset, and that is the honest state.','2026-07-20','2026-07-20T14:00:00+07:00'),
('ex-tired','tr-coffee-test','gap','distilled','solve','inherit','energy','Three days off afternoon coffee: no improvement','A clean disconfirmation — the result the caffeine hypothesis predicted against.',0.55,'2026-07-20T14:00:00+07:00','This is what a real test looks like: a blocker that a hypothesis cannot survive.','2026-07-20','2026-07-20T14:00:00+07:00'),
('ex-tired','tr-solution','solution','distilled','solve','inherit','energy','Protect a 7-hour sleep window; retest lunch next','Act on the leader (sleep debt) while queuing the next test (lunch). Do not declare victory yet.',0.5,'2026-07-20T14:00:00+07:00','A solution can be provisional: act on the best-supported claim without pretending the others are closed.','2026-07-20','2026-07-20T14:00:00+07:00');

INSERT INTO facets (vault_id,node_id,name,semantic,distillate,confidence) VALUES
('ex-tired','tr-problem','pattern','gating','Only weekdays — weekends are fine. The single biggest clue.',0.6),
('ex-tired','tr-problem','severity','informational','Need coffee or I am useless by 3pm.',0.4);

INSERT INTO edges (vault_id,src,from_facet,to_id,to_facet,rel,note) VALUES
('ex-tired','tr-problem',NULL,'tr-sleepdebt',NULL,'decomposes',NULL),
('ex-tired','tr-problem',NULL,'tr-caffeine',NULL,'decomposes',NULL),
('ex-tired','tr-problem',NULL,'tr-lunch',NULL,'decomposes',NULL),
('ex-tired','tr-problem',NULL,'tr-screens',NULL,'decomposes',NULL),
('ex-tired','tr-problem',NULL,'tr-iron',NULL,'decomposes',NULL),
('ex-tired','tr-coffee-test',NULL,'tr-caffeine',NULL,'blocks',NULL),
('ex-tired','tr-sleepdebt',NULL,'tr-solution',NULL,'answers',NULL),
('ex-tired','tr-problem','pattern','tr-sleepdebt',NULL,'drives','the weekday-only pattern points straight here');

INSERT INTO captures (vault_id,id,text,created) VALUES
('ex-tired','tr-cap','is the crash worse after meetings? note the days','2026-07-20');

-- ============================================================
-- ex-job — "Should I take the new job?"
-- Teaches the hypothesis-vs-open-question distinction: separate the
-- claims you are asserting-and-testing from the unknowns you must
-- investigate; keep the decision's confidence unset while they are live.
-- ============================================================
DELETE FROM nodes    WHERE vault_id='ex-job';
DELETE FROM facets   WHERE vault_id='ex-job';
DELETE FROM edges    WHERE vault_id='ex-job';
DELETE FROM captures WHERE vault_id='ex-job';

INSERT INTO nodes (vault_id,id,kind,state,region,lean,cluster,title,distillate_text,distillate_confidence,distillate_updated,body,created,updated) VALUES
('ex-job','jb-problem','problem','distilled','solve','inherit','decision','Take the new job, or stay?','A real fork. Separate what I am claiming from what I do not yet know — and do not force a confidence I have not earned.',0.5,'2026-07-20T10:00:00+07:00','Most bad decisions here come from treating an unknown as if it were settled. Sort each sub-node into claim vs. open question first.','2026-07-20','2026-07-20T10:00:00+07:00'),
('ex-job','jb-growth','hypothesis','distilled','solve','inherit','decision','The new role grows me faster than staying','A claim I am asserting, held weakly: bigger scope hints at it, but I have no outside data yet.',0.35,'2026-07-20T10:00:00+07:00','This is a hypothesis — a position I can argue and test — not a fact. Its confidence should stay low until a gap closes.','2026-07-20','2026-07-20T10:00:00+07:00'),
('ex-job','jb-scope','hypothesis','distilled','solve','inherit','decision','Scope is genuinely bigger — lead of 6 vs. solo','The one concrete, checkable premise under "growth". Confirmed from the job description.',0.6,'2026-07-20T10:00:00+07:00','A Reason under the growth claim: the piece that is actually verified, holding up the piece that is not.','2026-07-20','2026-07-20T10:00:00+07:00'),
('ex-job','jb-escape','hypothesis','distilled','solve','inherit','decision','I am mostly running from my boss, not toward this','A claim about my own motive — uncomfortable, but it predicts regret if true, so it is worth testing honestly.',0.45,'2026-07-20T10:00:00+07:00','A hypothesis pointed at myself. Naming it as a testable claim beats letting it operate unexamined.','2026-07-20','2026-07-20T10:00:00+07:00'),
('ex-job','jb-manager','hypothesis','freeform','solve','inherit','decision','Will the new manager actually be good?',NULL,NULL,NULL,'No position — this is an unknown, not a claim. Backchannel two ex-reports to resolve it. Confidence stays unset until then: pretending to know is the trap.','2026-07-20','2026-07-20T10:00:00+07:00'),
('ex-job','jb-equity','hypothesis','freeform','solve','inherit','decision','Is the equity actually worth anything?',NULL,NULL,NULL,'Unknown until I see strike price, preferences, and the last valuation. An open question, not a bet — left unset on purpose.','2026-07-20','2026-07-20T10:00:00+07:00'),
('ex-job','jb-nodata','gap','distilled','solve','inherit','decision','Haven''t spoken to anyone who left that company','The growth claim cannot earn confidence until this gap closes — no evidence, no promotion.',0.5,'2026-07-20T10:00:00+07:00','A blocker on the growth hypothesis. This is what keeps its confidence honestly low.','2026-07-20','2026-07-20T10:00:00+07:00'),
('ex-job','jb-plan','solution','distilled','solve','inherit','decision','Backchannel the manager + get equity terms, then decide in 2 weeks','Do not decide yet. Resolve the two open questions, close the data gap, then choose with earned confidence.',0.58,'2026-07-20T10:00:00+07:00','The output of a good decision graph is sometimes "run these checks first," not a snap answer.','2026-07-20','2026-07-20T10:00:00+07:00');

INSERT INTO facets (vault_id,node_id,name,semantic,distillate,confidence) VALUES
('ex-job','jb-problem','reversibility','gating','Hard to undo — I would be burning the bridge.',0.6),
('ex-job','jb-problem','timeline','informational','They want an answer in two weeks.',0.5);

INSERT INTO edges (vault_id,src,from_facet,to_id,to_facet,rel,note) VALUES
('ex-job','jb-problem',NULL,'jb-growth',NULL,'decomposes',NULL),
('ex-job','jb-problem',NULL,'jb-escape',NULL,'decomposes',NULL),
('ex-job','jb-problem',NULL,'jb-manager',NULL,'decomposes',NULL),
('ex-job','jb-problem',NULL,'jb-equity',NULL,'decomposes',NULL),
('ex-job','jb-growth',NULL,'jb-scope',NULL,'decomposes',NULL),
('ex-job','jb-nodata',NULL,'jb-growth',NULL,'blocks',NULL),
('ex-job','jb-growth',NULL,'jb-plan',NULL,'answers',NULL);

INSERT INTO captures (vault_id,id,text,created) VALUES
('ex-job','jb-cap','what would make me say no in 6 months? write it down now','2026-07-20');

-- ============================================================
-- Register the example projects (idempotent).
-- ============================================================
INSERT OR IGNORE INTO projects (vault_id,name,created) VALUES ('ex-bedtime','Bedtime meltdowns (example)','2026-07-20T20:00:00+07:00');
INSERT OR IGNORE INTO projects (vault_id,name,created) VALUES ('ex-tired','Always tired (example)','2026-07-20T14:00:00+07:00');
INSERT OR IGNORE INTO projects (vault_id,name,created) VALUES ('ex-job','Should I take the job? (example)','2026-07-20T10:00:00+07:00');
