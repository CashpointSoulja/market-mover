// Bluesky's public firehose (Jetstream): every new English post, live, no key needed.
const JETSTREAM = "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post";

export function streamPosts(onPost, stats) {
  const connect = () => {
    const ws = new WebSocket(JETSTREAM);
    ws.onmessage = (m) => {
      let j;
      try {
        j = JSON.parse(m.data);
      } catch {
        return;
      }
      if (j.commit?.operation !== "create") return;
      stats.posts++;
      const rec = j.commit.record ?? {};
      if (!rec.text || !(rec.langs ?? []).includes("en")) return;
      onPost({ id: `${j.did}/${j.commit.rkey}`, text: rec.text, createdAt: rec.createdAt });
    };
    ws.onclose = () => setTimeout(connect, 2000);
    ws.onerror = () => ws.close();
  };
  connect();
}
