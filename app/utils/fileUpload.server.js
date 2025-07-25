export async function uploadToBunnyCDN(file, storeName) {
  if (!file || !file.stream) {
    throw new Error("Invalid file");
  }

  // Get file extension
  const fileExtension = file.name.split('.').pop();
  
  // Create unique filename with current date
  const currentDate = new Date().toISOString().replace(/[-T:.]/g, "");
  const filename = `${storeName}-logo-${currentDate}.${fileExtension}`;
  
  // BunnyCDN storage URL
  const url = `https://storage.bunnycdn.com/app-country-blocker/${filename}`;

  console.log("Uploading to BunnyCDN:", url);
  console.log("File size:", file.size, "bytes");

  // Convert stream to buffer
  const chunks = [];
  const reader = file.stream().getReader();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  
  const buffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  // Upload to BunnyCDN
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: "ed471287-65b9-434e-b4e742b04408-94b6-459f",
      "Content-Type": file.type || "application/octet-stream",
    },
    body: buffer,
  });

  console.log("BunnyCDN Response status:", response.status);

  if (response.ok) {
    const publicUrl = `https://app-country-blocker.b-cdn.net/${filename}`;
    console.log("Logo uploaded successfully to BunnyCDN", publicUrl);
    
    return {
      filename,
      url: publicUrl,
      size: file.size,
    };
  } else {
    const errorText = await response.text();
    console.error("Failed to upload logo to BunnyCDN:", response.status, errorText);
    throw new Error(`BunnyCDN upload failed: ${response.status} ${errorText}`);
  }
}

export function validateImageFile(file) {
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/svg+xml"];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error("Invalid file type. Only JPEG, PNG, GIF, and SVG files are allowed.");
  }

  if (file.size > maxSize) {
    throw new Error("File too large. Maximum size is 5MB.");
  }

  return true;
}
