import assert from "node:assert/strict";
import test from "node:test";
import { resolveQueryConnection, validateReadQuery } from "./dbQuery";

const env = (extra: NodeJS.ProcessEnv = {}) => ({ PGHOST: "db.example", PGPORT: "5432", PGUSER: "reader", PGPASSWORD: "secret", PGDATABASE: "emphasys", ...extra });
test("conserva Emphasys sin parámetro", () => assert.equal(resolveQueryConnection(env()).database, "emphasys"));
test("permite paz_financiera de forma aislada", () => assert.equal(resolveQueryConnection(env({ DB_QUERY_DATABASE: "paz_financiera" })).database, "paz_financiera"));
test("rechaza destinos no permitidos y conflictos", () => {
  assert.throws(() => resolveQueryConnection(env({ DB_QUERY_DATABASE: "otra" })), /sólo puede/);
  assert.throws(() => resolveQueryConnection({ DATABASE_URL: "postgres://reader:secret@db.example/emphasys", DB_QUERY_DATABASE: "paz_financiera" }), /conflicto/);
});
test("acepta sólo lecturas y una sentencia", () => {
  validateReadQuery(" -- comentario\n SELECT 1;");
  validateReadQuery("WITH x AS (SELECT 1) SELECT * FROM x");
  assert.throws(() => validateReadQuery("UPDATE cuentas SET saldo = 0"), /sólo permite/);
  assert.throws(() => validateReadQuery("SELECT 1; DELETE FROM cuentas"), /sólo permite/);
});
