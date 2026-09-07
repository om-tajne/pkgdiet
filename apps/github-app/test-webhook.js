const payload = {
    event: "pull_request.opened",
    pull_request: {
        number: 42,
        base: { sha: "abc123" },
        head: { sha: "def456" },
    },
    repository: {
        id: 999,
        name: "test-repo",
        full_name: "test-org/test-repo",
        owner: { id: 123, login: "test-org" },
    },
};
const res = await fetch("http://localhost:3000/test-webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload }),
});
console.log(await res.json());
export {};
