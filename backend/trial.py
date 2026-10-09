import hashlib

# One Premium trial per email, ever: kept as a hash (not the address) in
# trial_claims, which survives deleting the account. Gmail ignores dots and
# "+anything" in the name, so those count as the same address.


def email_hash(email: str) -> str:
    email = email.strip().lower()
    name, _, domain = email.partition("@")
    if domain in ("gmail.com", "googlemail.com"):
        name = name.split("+", 1)[0].replace(".", "")
        domain = "gmail.com"
    return hashlib.sha256(f"{name}@{domain}".encode()).hexdigest()


if __name__ == "__main__":
    assert email_hash(" A.B+x@GoogleMail.com") == email_hash("ab@gmail.com")
    assert email_hash("a.b@example.com") != email_hash("ab@example.com")
    print("ok")
