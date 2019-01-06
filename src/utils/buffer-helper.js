exports.splitBufferToChunks = (buffer, chunkSize) => {
   const chunks = [];

   // Get how much can we split the buffer into chunks.
   let chunkNumber = Math.ceil(buffer.length / chunkSize);

   // The position of the chunk in the buffer array.
   let chunkPosition = 0;

   while (chunkNumber) {
      let chunk = buffer.slice(chunkPosition, chunkPosition += chunkSize);

      chunks.push(chunk);

      // Count down.
      chunkNumber--;
   }

   return chunks;
}