import modal


app = modal.App("libmodal-test-support")


@app.function()
def add_two_numbers(a: int, b: int) -> int:
    return a + b
