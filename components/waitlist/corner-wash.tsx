/**
 * Soft grain washes in the top-left and bottom-right corners.
 * Light sits on the black rest stage; dark sits on the white manifesto.
 * The dive fades the light pair with the rest of the stage.
 */
export function WaitlistCornerWash({ tone }: { tone: "light" | "dark" }) {
  return (
    <div aria-hidden className={`waitlist-corners waitlist-corners-${tone}`}>
      <div className="waitlist-corner waitlist-corner-tl">
        <div className="waitlist-corner-glow" />
        <div className="waitlist-corner-grain" />
      </div>
      <div className="waitlist-corner waitlist-corner-br">
        <div className="waitlist-corner-glow" />
        <div className="waitlist-corner-grain" />
      </div>
    </div>
  )
}
