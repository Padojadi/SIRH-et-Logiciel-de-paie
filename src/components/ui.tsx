import Link from "next/link";

export function PageHeader({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker?: string;
  title: string;
  lede?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Flash({ ok, erreur }: { ok?: string; erreur?: string }) {
  if (erreur) return <p className="flash err">{erreur}</p>;
  if (ok) return <p className="flash ok">{ok}</p>;
  return null;
}

export function Badge({ kind, children }: { kind?: "ok" | "warn" | "danger" | "info"; children: React.ReactNode }) {
  return <span className={kind ? `badge ${kind}` : "badge"}>{children}</span>;
}

export function Money({ value }: { value: number }) {
  return <span>{new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(value))}</span>;
}

export function LinkButton({ href, children, secondary }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return <Link className={secondary ? "button secondary" : "button"} href={href}>{children}</Link>;
}

export function DateRange({ from, to }: { from: string; to: string }) {
  return (
    <form className="panel actions" method="get">
      <label>Du<input type="date" name="from" defaultValue={from} /></label>
      <label>Au<input type="date" name="to" defaultValue={to} /></label>
      <button className="secondary" type="submit">Actualiser</button>
    </form>
  );
}
