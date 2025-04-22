use std::{
    collections::HashMap,
    env,
    time::{Duration, Instant},
};

use anyhow::{Context, bail};
use bytes::Bytes;
use libmodal::proto::{
    MAX_MESSAGE_SIZE,
    client::{
        DataFormat, DeploymentNamespace, FunctionCallInvocationType, FunctionCallType,
        FunctionGetOutputsRequest, FunctionGetRequest, FunctionInput, FunctionMapRequest,
        FunctionPutInputsItem, function_input::ArgsOneof, generic_result,
        modal_client_client::ModalClientClient,
    },
};
use named_retry::Retry;
use serde_pickle::{DeOptions, SerOptions};
use tonic::{
    metadata::AsciiMetadataValue,
    service::interceptor::InterceptedService,
    transport::{Channel, Endpoint},
};

fn get_two_numbers() -> (i32, i32) {
    // Collect command line arguments into a vector
    let args: Vec<String> = std::env::args().collect();

    // Ensure exactly 3 arguments (program name, x, y) are provided
    if args.len() != 3 {
        panic!("Usage: {} <x> <y>", args[0]);
    }

    // Parse the arguments into i32 values
    let x: i32 = args[1]
        .parse()
        .expect("Please provide a valid integer for x.");
    let y: i32 = args[2]
        .parse()
        .expect("Please provide a valid integer for y.");

    // Return the two numbers as a tuple
    (x, y)
}

async fn get_function_id<F>(
    client: ModalClientClient<InterceptedService<Channel, F>>,
) -> Result<String, tonic::Status>
where
    F: Fn(tonic::Request<()>) -> Result<tonic::Request<()>, tonic::Status> + Clone,
{
    let resp = Retry::new("function_get")
        .run(|| {
            let mut client = client.clone();
            let req = FunctionGetRequest {
                app_name: String::from("bad8"),
                object_tag: String::from("add_two"),
                namespace: DeploymentNamespace::Workspace.into(),
                environment_name: String::from("main"),
            };
            async move { client.function_get(req).await }
        })
        .await?
        .into_inner();

    let function_id = resp.function_id;
    _ = resp.handle_metadata; // ignore function type, etc., for now

    Ok(function_id)
}

use std::hint::black_box;

use serde_pickle as pickle;

#[expect(dead_code)]
fn not_main() {
    // Generate a 2D vector similar to Python's list comprehension
    let li: Vec<Vec<Vec<f64>>> = (0..1000)
        .map(|_| (0..10000).map(|_| vec![fastrand::f64()]).collect())
        .collect();

    // Start timing
    let start = Instant::now();

    // Run the serialization 5 times
    (0..5).for_each(|_| {
        let serialized = pickle::to_vec(&li, SerOptions::new()).expect("Serialization failed");
        black_box(serialized); // Use black_box to prevent optimization
    });
    let elapsed = start.elapsed().as_secs_f64() / 5.0;
    println!("Average time: {} seconds", elapsed);
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let channel = Endpoint::new("https://api.modal.com")?
        .buffer_size(1 << 20) // Max concurrent requests
        .initial_stream_window_size(64 * 1024 * 1024) // 64 MB
        .initial_connection_window_size(64 * 1024 * 1024) // 64 MB
        .connect()
        .await?;

    let token_id: AsciiMetadataValue = env::var("MODAL_TOKEN_ID")?.parse()?;
    let token_secret: AsciiMetadataValue = env::var("MODAL_TOKEN_SECRET")?.parse()?;

    let mut client =
        ModalClientClient::with_interceptor(channel, |mut request: tonic::Request<()>| {
            // x-modal-token-id
            // x-modal-token-secret
            let m = request.metadata_mut();
            m.insert("x-modal-token-id", token_id.clone());
            m.insert("x-modal-token-secret", token_secret.clone());
            m.insert(
                "x-modal-client-version",
                AsciiMetadataValue::from_static("0.64.168"),
            );
            m.insert("x-modal-client-type", AsciiMetadataValue::from_static("1"));
            Ok(request)
        })
        .max_encoding_message_size(MAX_MESSAGE_SIZE)
        .max_decoding_message_size(MAX_MESSAGE_SIZE);

    // let resp = client.client_hello(()).await?;
    // println!("RESPONSE={:?}", resp);

    let function_id = get_function_id(client.clone()).await?;

    // Get two numbers x and y as cli arguments
    let (x, y) = get_two_numbers();

    let args_kwargs = (vec![x, y], HashMap::<(), ()>::new());
    let payload = serde_pickle::to_vec(&args_kwargs, SerOptions::new())?;

    let req = FunctionMapRequest {
        function_id: function_id.clone(),
        function_call_type: FunctionCallType::Unary.into(),
        pipelined_inputs: vec![FunctionPutInputsItem {
            idx: 0,
            input: Some(FunctionInput {
                data_format: DataFormat::Pickle.into(),
                args_oneof: Some(ArgsOneof::Args(Bytes::from(payload))),
                ..Default::default()
            }),
        }],
        function_call_invocation_type: FunctionCallInvocationType::SyncLegacy.into(),
        ..Default::default()
    };

    let resp = client.function_map(req).await?.into_inner();
    let function_call_id = resp.function_call_id;

    println!("Created function call ID {}", function_call_id);

    const TIMEOUT: Duration = Duration::from_secs(60);

    let req = FunctionGetOutputsRequest {
        function_call_id: function_call_id.clone(),
        timeout: TIMEOUT.as_secs_f32() - 5.0,
        last_entry_id: "0-0".into(),
        ..Default::default()
    };
    let resp = client.function_get_outputs(req).await?.into_inner();

    if !resp.outputs.is_empty() {
        let output = resp.outputs.into_iter().next().unwrap();
        let data_format = output.data_format();
        if data_format != DataFormat::Pickle {
            bail!("bad data format {data_format:?}");
        }
        let result = output.result.context("missing result")?;
        let data = match result.data_oneof {
            Some(generic_result::DataOneof::Data(data)) => data,
            _ => bail!("unsupported data (todo)"),
        };
        let result: i32 = serde_pickle::from_slice(&data, DeOptions::new())?;
        println!("Result: {}", result);
    } else {
        println!("No outputs yet after waiting, time to exit");
    }

    Ok(())
}
