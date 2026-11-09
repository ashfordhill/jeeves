import { execFile } from "node:child_process";
import { promisify } from "node:util";
/** Check the retained media binaries before opening a job consumer or advertising ready.
 * The Docker stage verifies the Debian package hash and complete OS package lock. */
export async function verifyVideoRuntime(): Promise<void> {
	for (const binary of ["ffmpeg", "ffprobe"]) {
		const result = await promisify(execFile)(binary, ["-version"], {
			timeout: 30000,
			maxBuffer: 65536,
		});
		if (!result.stdout.startsWith(`${binary} version 5.1.9-0+deb12u1`))
			throw Error("Unexpected pinned media binary");
	}
}
