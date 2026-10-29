// What a coding agent would write: a page that shows data from the links service.
import { useApis } from "@jeeves/web-runtime";
import { useEffect, useState } from "react";
import type { app } from "../jeeves.generated.ts";

export function Home() {
  const { links } = useApis<typeof app.apis>();
  const [message, setMessage] = useState<string>();
  const [failure, setFailure] = useState<string>();
  useEffect(() => {
    links.GET("/ping", { params: { query: { message: "from-the-browser" } } }).then(
      ({ data, error }) => (data ? setMessage(data.message) : setFailure(JSON.stringify(error))),
      (error: Error) => setFailure(error.message),
    );
  }, [links]);
  return (
    <section>
      <h2>Ping</h2>
      {message && <p data-testid="ping">{message}</p>}
      {failure && <p role="alert">{failure}</p>}
    </section>
  );
}
