exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
    body: "pong from Netlify function",
  };
};
