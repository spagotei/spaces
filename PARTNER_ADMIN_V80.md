# Spaces Partner Admin — V80

Support Console > Partners provides a review UI. Production approval requires POST /v1/support/partners on the Worker. The endpoint must enforce Support/Staff/Founder authorization, validate the Space and owner, write authoritative Partner status, update the public trust projection, and create an audit event.
