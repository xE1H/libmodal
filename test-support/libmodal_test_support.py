import modal


app = modal.App("libmodal-test-support")


@app.function()
def echo_string(s: str) -> str:
    return "output: " + s
