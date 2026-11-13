import { writeFileSync, rmSync } from "node:fs";
export interface ProcessScope {
	own(close: () => void | Promise<void>): void;
	transport(value: { closed: Promise<{ fatal: boolean }> }): void;
	fail(error?: unknown): void;
	ready(): void;
}
/** One error line when startup, the process or a drain fails: why, as the error's name and
 * message in at most 300 characters. Writing it never throws. */
function logError(event: string, error: unknown) {
	try {
		const why = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
		console.error(JSON.stringify({ level: "error", event, error: why.slice(0, 300) }));
	} catch {
		/* The drain still runs. */
	}
}
/** One process owns its readiness and ordered drains. Register dependencies before dependents;
 * reverse close stops admission/consumers/timers before publishers, clients and pools. */
export async function runProcess(
	start: (scope: ProcessScope) => Promise<void>,
) {
	const marker = "/tmp/application-ready";
	rmSync(marker, { force: true });
	const drains: (() => void | Promise<void>)[] = [];
	let stopping = false,
		failed = false,
		closing: Promise<void> | undefined;
	const close = () => {
		stopping = true;
		rmSync(marker, { force: true });
		return (closing ??= (async () => {
			for (const drain of drains.reverse()) {
				try {
					await drain();
				} catch (error) {
					logError("drain-failed", error);
					failed = true;
				}
			}
			process.exitCode = failed ? 1 : 0;
		})());
	};
	const scope: ProcessScope = {
		own(drain) {
			drains.push(drain);
		},
		transport(value) {
			void value.closed.then((result) => {
				if (!stopping) {
					failed ||= result.fatal;
					stopping = true;
					rmSync(marker, { force: true });
					void starting.finally(close).catch(() => {});
				}
			});
		},
		fail(error) {
			if (error !== undefined) logError("process-failed", error);
			failed = true;
			stopping = true;
			rmSync(marker, { force: true });
			void starting.finally(close).catch(() => {});
		},
		ready() {
			if (stopping) throw Error("Process stopped during startup");
			writeFileSync(marker, "ready\n");
			console.log("Application ready");
		},
	};
	// Await startup before drain so a late constructor cannot escape ownership.
	let starting: Promise<void>;
	const signal = () => {
		stopping = true;
		rmSync(marker, { force: true });
		void starting.finally(close).catch(() => {});
	};
	process.once("SIGTERM", signal);
	process.once("SIGINT", signal);
	starting = Promise.resolve().then(() => start(scope));
	try {
		await starting;
	} catch (error) {
		failed = true;
		await close();
		logError("startup-failed", error);
		console.error("Application startup failed");
	}
}
export function periodic(
	scope: ProcessScope,
	effect: () => Promise<unknown>,
	ms: number,
	onFailure?: (error: unknown) => void,
) {
	let timer: ReturnType<typeof setTimeout> | undefined,
		stopped = false,
		running = Promise.resolve<unknown>(undefined);
	const tick = () => {
		running = effect()
			.catch((error: unknown) => {
				try {
					onFailure?.(error);
				} catch {
					/* The next tick still runs. */
				}
			})
			.finally(() => {
				if (!stopped) timer = setTimeout(tick, ms);
			});
	};
	tick();
	scope.own(async () => {
		stopped = true;
		clearTimeout(timer);
		await running;
	});
}
