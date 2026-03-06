export default function RatingStars({ value = 0 }) {
  const rounded = Math.round(value * 10) / 10;

  const full = Math.floor(rounded);
  const half = rounded - full >= 0.5;

  const total = 5;
  const stars = [];

  for (let i = 1; i <= total; i++) {
    if (i <= full) stars.push("★");
    else if (i === full + 1 && half) stars.push("⯪"); // simple half indicator
    else stars.push("☆");
  }

  return (
    <span aria-label={`Rating ${rounded} out of 5`} title={`${rounded} / 5`}>
      {stars.join(" ")}{" "}
      <span style={{ fontSize: "0.9em", opacity: 0.7 }}>({rounded})</span>
    </span>
  );
}