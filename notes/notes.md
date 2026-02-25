
#converted to seperate frontend backend deployments. frontend just needs the vite_api for the backend. 




routes — just maps URLs to controller functions, no logic
controllers — handles request/response, calls models
models — database schema + queries (Mongoose/Prisma/raw SQL)
middleware — runs before controller (auth checks, validation)