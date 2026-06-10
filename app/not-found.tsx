export default function NotFound() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      backgroundColor: "#1A1208",
      color: "white",
      fontFamily: "system-ui, sans-serif",
      textAlign: "center",
      padding: "20px",
    }}>
      <h1 style={{ fontSize: "48px", marginBottom: "10px" }}>404</h1>
      <p style={{ fontSize: "24px", marginBottom: "30px" }}>Page Not Found</p>
      <p style={{ fontSize: "16px", color: "#FFD500", marginBottom: "30px" }}>
        This page doesn't exist or there's an issue loading it.
      </p>
      <a
        href="/"
        style={{
          padding: "12px 24px",
          backgroundColor: "#FFD500",
          color: "#1A1208",
          textDecoration: "none",
          borderRadius: "8px",
          fontWeight: "bold",
          fontSize: "16px",
        }}
      >
        Go Home
      </a>
    </div>
  );
}
