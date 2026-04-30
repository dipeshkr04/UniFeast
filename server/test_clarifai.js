const fs = require('fs');
const { ClarifaiStub, grpc } = require("clarifai-nodejs-grpc");

require('dotenv').config({ path: './.env' });

const stub = ClarifaiStub.grpc();
const metadata = new grpc.Metadata();
metadata.set("authorization", `Key ${process.env.CLARIFAI_PAT}`);

const imageBytes = fs.readFileSync('../Sample Test Images/Tomato.jpg').toString('base64');

stub.PostModelOutputs(
  {
    user_app_id: {
      user_id: 'clarifai',
      app_id: 'main'
    },
    model_id: "food-item-recognition",
    inputs: [
      { data: { image: { base64: imageBytes } } }
    ]
  },
  metadata,
  (err, response) => {
    if (err) {
      console.error("Clarifai Error:", err);
      process.exit(1);
    }

    if (response.status.code !== 10000) {
      console.error("Clarifai Request failed:", response.status.description);
      process.exit(1);
    }

    const concepts = response.outputs[0].data.concepts;
    if (concepts && concepts.length > 0) {
      console.log("Top prediction:", concepts[0].name);
      console.log("Confidence:", concepts[0].value);
    } else {
      console.log("No concepts found.");
    }
  }
);
