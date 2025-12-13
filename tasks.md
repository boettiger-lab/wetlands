
We currently have a langchainjs based chat.js on this app that can answer questions about data shown on the map (maplibre gl, see map.js file).  I would like to add a second 'tool use' ability to the chat-bot that would allow it to update the maplibre map in various ways.  

This could be difficult to get consistent and robust.  We may need to consider a few different strategies. There are various different map updates we might want to consider -- hide/show layers, filter existing layers, update the 'paint' section to color map polygons differently.  I don't know if these should each be separate "tools", or a single more flexible tool.  one or the other option might be easier for our small open-weigths LLMs like GPT-OSS to get correct.  

To get started, let's figure out the communication mechanism from chatbot to map.  Can you implement a second 'tool' for the chatbot that allows it to toggle the existing map.js layers shown in the "Overlay" box (carbon, GLWD, Ramsar sites, etc) off or on?  
