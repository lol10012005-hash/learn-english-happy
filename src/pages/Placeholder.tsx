type Props = {
  title: string
  note: string
}

export default function Placeholder({ title, note }: Props) {
  return (
    <section className="card">
      <h1>{title}</h1>
      <p>{note}</p>
    </section>
  )
}